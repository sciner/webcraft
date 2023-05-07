import { ArrayHelpers, ObjectHelpers, Vector } from "../helpers.js";
import { BLOCK } from "../blocks.js";
import { Label } from "../ui/wm.js";
import {CraftTableInventorySlot, CraftTableSlot} from "./base_craft_window.js";
import { ServerClient } from "../server_client.js";
import { DEFAULT_CHEST_SLOT_COUNT, INVENTORY_DRAG_SLOT_INDEX,
    CHEST_INTERACTION_MARGIN_BLOCKS, MAX_DIRTY_INVENTORY_DURATION, UI_THEME, BAG_LENGTH_MAX, HOTBAR_LENGTH_MAX, BAG_LINE_COUNT, CHEST_LINE_COUNT
} from "../constant.js";
import { INVENTORY_CHANGE_NONE, INVENTORY_CHANGE_SLOTS, 
    INVENTORY_CHANGE_CLOSE_WINDOW } from "../inventory.js";
import { ChestHelpers, isBlockRoughlyWithinPickatRange } from "../block_helpers.js"
import { Lang } from "../lang.js";
import { BaseInventoryWindow } from "./base_inventory_window.js"
import type { TBlock } from "../typed_blocks3.js";

class ChestConfirmData {
    chestSessionId: string
    chest: { pos: Vector, slots: Dict<IInventoryItem> }
    secondChest: { pos: Vector, slots: Dict<IInventoryItem> }
    inventory_slots: IInventoryItem[]
    change: any
}

export class BaseChestWindow extends BaseInventoryWindow {

    chest: { slots: CraftTableInventorySlot[] }

    constructor(x, y, w, h, id, title, text, inventory, options) {

        super(x, y, w, h, id, title, text, inventory)

        this.options = options
        this.x *= this.zoom 
        this.y *= this.zoom
        this.w *= this.zoom
        this.h *= this.zoom

        // Ширина / высота слота
        this.cell_size     = UI_THEME.window_slot_size * this.zoom
        this.slot_margin   = UI_THEME.slot_margin * this.zoom
        this.slots_x       = UI_THEME.window_padding * this.zoom
        this.slots_y       = 62 * this.zoom

        this.firstLoading  = false;
        this.secondLoading = false;
        this.timeout    = null;
        this.maxDirtyTime  = null;

        this.setBackground('./media/gui/form-quest.png')

        // Создание слотов
        this.createSlots(this.prepareSlots())

        // Создание слотов для инвентаря
        const slots_width = (((this.cell_size / this.zoom) + UI_THEME.slot_margin) * BAG_LINE_COUNT) - UI_THEME.slot_margin + UI_THEME.window_padding
        this.createInventorySlots(this.cell_size, (this.w / this.zoom) - slots_width, 60, UI_THEME.window_padding, undefined, true)
        
        this.lastChange = {
            type: INVENTORY_CHANGE_NONE,
            // the slots are ignored when (type == INVENTORY_CHANGE_CLOSE_WINDOW)
            slotIndex: -1,
            slotInChest: false,
            slotPrevItem: null,
            dragPrevItem: null,
            prevInventory: null
        }

        // A random number. If it's null, no confirmation
        // is reqested when closing.
        this.chestSessionId = null

        //
        this.blockModifierListener = (tblock : TBlock) => {
            let targetInfo : any = null
            const posworld = tblock.posworld;
            if (this.info.pos.equal(posworld)) {
                targetInfo = this.info
            } else if (this.secondInfo && this.secondInfo.pos.equal(posworld)) {
                targetInfo = this.secondInfo
            } else {
                return
            }
            // If a chest was removed by the server
            if (tblock.id !== targetInfo.block_id) {
                this.hideAndSetupMousePointer() // It also takes care of the dragged item.
                return
            }
            const mat = tblock.material
            if (!(mat.chest.private || mat.id === BLOCK.ENDER_CHEST.id)) {
                this.setLocalData(tblock)
            }
        }

        // Add labels to window
        this.lbl2 = new Label((this.w / this.zoom) - slots_width, 60, 0, 0, 'lbl2', null, '')
        this.add(this.lbl2);
        for(let lbl of [this.lbl2]) {
            lbl.style.font.color = UI_THEME.label_text_color
            lbl.style.font.size = UI_THEME.base_font.size
        }

        // Add listeners for server commands
        this.server.AddCmdListener([ServerClient.CMD_CHEST_CONTENT], (cmd) => {
            this.setData(cmd.data);
        });

        this.server.AddCmdListener([ServerClient.CMD_CHEST_FORCE_CLOSE], (cmd) => {
            if (cmd.data.chestSessionId === this.chestSessionId) {
                if (this.visible) {
                    this.chestSessionId = null; // it prevents sending the closing request
                    this.hideAndSetupMousePointer();
                } else {
                    // it might be before the timer
                    this.dontShowChestSessionId = this.chestSessionId;
                }
            }
        })

        // Add labels to window
        this.addWindowTitle(options.title)

        // Add close button
        this.addCloseButton()

        // Catch action
        this.catchActions()

    }

    // Обработчик открытия формы
    onShow(args : any) {
        this.lastChange.type = INVENTORY_CHANGE_NONE
        this.getRoot().center(this)
        Qubatch.releaseMousePointer()
        if(this.options.sound.open) {
            Qubatch.sounds.play(this.options.sound.open.tag, this.options.sound.open.action)
        }
        this.world.blockModifierListeners.push(this.blockModifierListener)
        super.onShow(args)
        this.fixAndValidateSlots('onShow')
        this.refresh()
    }

    // Обработчик закрытия формы
    onHide(was_visible : boolean) {
        if (this.chestSessionId != null) { // if the closing wasn't forced by the server
            this.lastChange.type = INVENTORY_CHANGE_CLOSE_WINDOW
            // Перекидываем таскаемый айтем в инвентарь, чтобы не потерять его
            // @todo Обязательно надо проработать кейс, когда в инвентаре нет места для этого айтема
            this.inventory.clearDragItem(true)
            this.fixAndValidateSlots('clearDragItem')
            this.confirmAction()
        }
        if(was_visible && this.options.sound.close) {
            Qubatch.sounds.play(this.options.sound.close.tag, this.options.sound.close.action)
        }
        this.info = null; // disables AddCmdListener listeners 
        ArrayHelpers.fastDeleteValue(this.world.blockModifierListeners, this.blockModifierListener)
    }

    // Catch action
    catchActions() {

        const self = this

        // Remembers two affected slots before a user action is executed.
        function updateLastChangeSlots(craftSlot) {
            const lastChange = craftSlot.parent.lastChange;
            lastChange.type = INVENTORY_CHANGE_SLOTS;
            lastChange.slotIndex = craftSlot.getIndex();
            lastChange.slotInChest = craftSlot.is_chest_slot;
            const item = craftSlot.getItem();
            lastChange.slotPrevItem = item ? { ...item } : null;
            const dargItem = self.inventory.items[INVENTORY_DRAG_SLOT_INDEX];
            lastChange.dragPrevItem = dargItem ? { ...dargItem } : null;
            // We need only shallow copies of elements (to preserve count)
            lastChange.prevInventory = ObjectHelpers.deepClone(self.inventory.items, 2);
        }

        //
        const handlerMouseDown = function(e) {
            updateLastChangeSlots(this);
            this._originalMouseDown(e);
            this.parent.confirmAction();
        }

        //
        const handlerOnDrop = function(e) {
            updateLastChangeSlots(this);
            this._originalOnDrop(e);
            this.parent.confirmAction();
        }

        //
        for(let slots of [this.chest.slots, this.inventory_slots]) {
            for(let slot of slots) {
                // mouse down
                slot._originalMouseDown = slot.onMouseDown;
                slot.onMouseDown = handlerMouseDown;
                // drop
                slot._originalOnDrop = slot.onDrop;
                slot.onDrop = handlerOnDrop;
            }
        }

    }

    // Confirm action
    confirmAction() {
        this.fixAndValidateSlots('confirmAction')

        const that = this

        function extractOneChest(isFirst, info) {
            const res = { pos: info.pos, slots: {} };
            const range = ChestHelpers.getOneChestRange(isFirst, that.secondInfo, that.chest.slots.length);
            for(var i = range.min; i < range.max; i++) {
                let item = that.chest.slots[i]?.item;
                if (item) {
                    res.slots[i - range.min] = item;
                }
            }
            return res;
        }

        if (this.lastChange.type === INVENTORY_CHANGE_NONE) {
            return;
        }
        // Delay sending changes that don't affect the chest.
        if (this.lastChange.type === INVENTORY_CHANGE_SLOTS && !this.lastChange.slotInChest) {
            const now = performance.now();
            this.maxDirtyTime = this.maxDirtyTime ?? now + MAX_DIRTY_INVENTORY_DURATION;
            if (this.loading || this.maxDirtyTime > now) {
                return;
            }
        }
        // Here there may or may not be some change, described by this.lastChange or not.
        const params = {
            chestSessionId:  this.chestSessionId,
            chest:           extractOneChest(true, this.info),
            inventory_slots: new Array(this.inventory.items.length),
            change:          { ...this.lastChange }
        } as ChestConfirmData;
        if (this.secondInfo) {
            params.secondChest = extractOneChest(false, this.secondInfo);
        }
        // inventory
        for(let i = 0; i < this.inventory.items.length; i++) {
            params.inventory_slots[i] = this.inventory.items[i];
        }
        for(let slot of this.inventory_slots) {
            const item = slot.getItem();
            params.inventory_slots[slot.slot_index] = item || null;
        }
        // Send to server
        this.server.ChestConfirm(params);
        // Forget the previous inventory. If there are no changes, it won't be sent next time.
        this.lastChange.prevInventory = null;
        this.maxDirtyTime = null;
    }

    get loading() {
        return this.firstLoading || this.secondLoading;
    }

    // Запрос содержимого сундука
    load(info, secondInfo = null) {
        if (this.timeout) { // a player is clicking too fast
            return;
        }

        this.chestSessionId = Math.random();
        let that = this;
        this.lbl1.setText(Lang['chest_loading']);
        this.clear();

        // analyze the 1st chest
        info.chestSessionId = this.chestSessionId;
        this.info = info;
        const firstBlock = this.world.getBlock(info.pos);
        const firstMat = firstBlock.material;
        this.firstLoading = firstMat.chest.private || firstMat.id === BLOCK.ENDER_CHEST.id;

        // analyze an load the 2nd chest
        this.secondInfo = secondInfo;
        this.secondLoading = false;
        if (secondInfo) {
            secondInfo.chestSessionId = this.chestSessionId;
            const secondBlock = this.world.getBlock(secondInfo.pos);
            const secondMat = secondBlock.material
            this.secondLoading = secondMat.chest.private || secondMat.id === BLOCK.ENDER_CHEST.id;

            // Both chest requests send both positions to set player.currentChests properly
            secondInfo.otherPos = info.pos;
            info.otherPos = secondInfo.pos;

            if (this.secondLoading) {
                this.server.LoadChest(secondInfo);
            } else {
                this.setLocalData(secondBlock);
            }
        }

        // load the 1st chest after the 2nd one was analyzed, so we "loading" getter works correctly
        if (this.firstLoading) {
            this.server.LoadChest(info);
        } else {
            this.setLocalData(firstBlock);
        }

        if (this.loading) {
            this.timeout = setTimeout(function() {
                that.timeout = null;
                if (that.dontShowChestSessionId !== that.chestSessionId) {
                    that.show();
                }
            }, 50);
        } else {
            this.show();
        }
    }

    setLocalData(tblock) {
        // see WorldChestManager.sendContentToPlayers()
        this.setData({
            pos:            tblock.posworld,
            slots:          tblock.extra_data.slots,
            state:          tblock.extra_data.state
        });
    }

    // Пришло содержимое сундука от сервера
    setData(chest) {
        if (!this.info) {
            return;
        }
        var isFirst = false;
        const wasLoading = this.loading;
        if (this.info.pos.equal(chest.pos)) {
            this.firstLoading = false;
            this.state = chest?.state || null;
            isFirst = true;
        } else if (this.secondInfo && this.secondInfo.pos.equal(chest.pos)) {
            this.secondLoading = false;
        } else {
            // пришло содержимое другого сундука (не просматриваемого в данный момент)
            return;
        }
        //
        if (!this.loading) {
            if (wasLoading) {
                // do we really need it?
                this.inventory.player.stopAllActivity();
            }
            const title = this.world.getBlock(this.info.pos)?.extra_data?.label
                ?? (this.secondInfo && this.world.getBlock(this.secondInfo.pos)?.extra_data?.label)
                ?? this.options.title;
            this.lbl1.setText(title);
        }
        // copy data slots to the UI slots
        const range = ChestHelpers.getOneChestRange(isFirst, this.secondInfo, this.chest.slots.length)
        for(var i = range.min; i < range.max; i++) {
            // this.chest.slots[i].item = chest.slots[i - range.min] || null;
            this.chest.slots[i].setItem(chest.slots[i - range.min] || null)
        }
        this.fixAndValidateSlots('setData')
    }

    // Очистка слотов сундука от предметов
    clear() {
        for(let slot of this.chest.slots) {
            slot.clear()
        }
    }

    // Prepare slots based on specific window type
    prepareSlots(count = DEFAULT_CHEST_SLOT_COUNT) {

        const resp  = [];
        const xcnt  = CHEST_LINE_COUNT
        const sx    = this.slots_x
        const sy    = 60 * this.zoom
        const sz    = this.cell_size
        const szm   = sz + this.slot_margin

        for(let i = 0; i < count; i++) {
            const pos = new Vector(
                sx + (i % xcnt) * szm,
                sy + Math.floor(i / xcnt) * szm,
                0
            );
            resp.push({pos})
        }

        return resp

    }

    /**
    * Creates chest slots.
    * @param {Array} slots_info - the array of {x, y} objects - slot positions on
    *   the screen. It's the value retuned by {@link prepareSlots}
    */
    createSlots(slots_info) {
        const ct = this
        if(ct.chest) {
            console.error('createCraftSlots() already created')
            return
        }
        const sz = this.cell_size
        this.chest = {
            /**
             * @type {CraftTableInventorySlot[]}
             */
            slots: []
        }
        for(let i in slots_info) {
            const info = slots_info[i]
            const options = {
                readonly: info.readonly,
                disableIfLoading: true,
                onMouseEnterBackroundColor: '#ffffff33'
            };
            const lblSlot = new CraftTableInventorySlot(info.pos.x, info.pos.y, info.size ?? sz, info.size ?? sz,
                `lblCraftChestSlot${i}`, null, null, this, null, options)
            lblSlot.index = i
            lblSlot.is_chest_slot = true
            this.chest.slots.push(lblSlot)
            ct.add(lblSlot)
        }
    }

    refresh() {
        const hotbar_len = this.inventory.getHotbarLength()
        const bag_len = this.inventory.getBagLength()
        for (let i = 0; i < (BAG_LENGTH_MAX + HOTBAR_LENGTH_MAX); i++) {
            this.inventory_slots[i].locked = ((i <= hotbar_len || i >= HOTBAR_LENGTH_MAX) && i < bag_len) ? false : true
            this.inventory_slots[i].refresh()
        }
    }

    getCraftOrChestSlots(): CraftTableSlot[] {
        return this.chest.slots;
    }

    onUpdate() {
        super.onUpdate();
        if (!isBlockRoughlyWithinPickatRange(Qubatch.player, CHEST_INTERACTION_MARGIN_BLOCKS,
            this.info.pos, this.secondInfo?.pos)
        ) {
            this.hideAndSetupMousePointer();
        } else if (!this.loading && this.maxDirtyTime && this.maxDirtyTime < performance.now()) {
            this.confirmAction();
        }
    }

    fixAndValidateSlots(context) {
        super.fixAndValidateSlots(context)
        for(const slot of this.chest.slots) {
            const item = slot.getItem()
            if (item?.count === 0) {
                slot.setItem(null)
                const str = `Error: "count":0 in chest slot ${item}`
                console.error(str)
                window.alert(str)
            }
        }
    }

}