import { ArrayHelpers, ObjectHelpers, Vector } from "../helpers.js";
import { BLOCK } from "../blocks.js";
import { Label } from "../ui/wm.js";
import {CraftTableInventorySlot, CraftTableSlot} from "./base_craft_window.js";
import { ServerClient } from "../server_client.js";
import {BAG_LINE_COUNT, CHEST_INTERACTION_MARGIN_BLOCKS, CHEST_LINE_COUNT, DEFAULT_CHEST_SLOT_COUNT, INVENTORY_DRAG_SLOT_INDEX, MAX_DIRTY_INVENTORY_DURATION, UI_THEME} from "../constant.js";
import {ChestHelpers, isBlockRoughlyWithinPickatRange, TChestInfo} from "../block_helpers.js"
import { Lang } from "../lang.js";
import { BaseInventoryWindow } from "./base_inventory_window.js"
import type { TBlock } from "../typed_blocks3.js";
import {CHEST_CHANGE, TChestChange, TChestConfirmData} from "../inventory.js";

export class BaseChestWindow extends BaseInventoryWindow {

    /** Слоты сундука, или объединение двух сундуков */
    chest: { slots: CraftTableInventorySlot[] }

    /** Описывает последнее произошедшее изменение (которое должно быть отиправлено на сервер) */
    lastChange: TChestChange = {
        type: CHEST_CHANGE.NONE,
        slotIndex: -1,
        slotInChest: false,
        slotPrevItem: null,
        dragPrevItem: null,
        prevInventory: null
    }

    /** A random number. If it's null, no confirmation is requested when closing. */
    chestSessionId: number | null = null

    info            : TChestInfo        // информация о первом сундуке
    secondInfo      : TChestInfo | null // информация о втором сундуке

    firstLoading    = false
    secondLoading   = false
    changeLoading   = false // если true, то оба сундука загружены, но клент ждет результат какой-то операции над нимим
    timeout         : any = null
    maxDirtyTime    : number | null = null

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

        this.setBackground('./media/gui/form-quest.png')

        // Создание слотов
        this.createSlots(this.prepareSlots())

        // Создание слотов для инвентаря
        const slots_width = (((this.cell_size / this.zoom) + UI_THEME.slot_margin) * BAG_LINE_COUNT) - UI_THEME.slot_margin + UI_THEME.window_padding
        this.createInventorySlots(this.cell_size, (this.w / this.zoom) - slots_width, 60, UI_THEME.window_padding, undefined, true)

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

        this.server.AddCmdListener([ServerClient.CMD_CHEST_CHANGE_PROCESSED], (cmd: INetworkMessage<int>) => {
            if (cmd.data === this.chestSessionId) {
                this.changeLoading = false
                this.onLoadingChanged()
            }
        })

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

    protected onLoadingChanged(): void {
        const loading = this.loading
        for(const slot of this.chest.slots) {
            slot.locked = loading
        }
    }

    protected createButtonSortChest(): void {
        this.createButtonSort(false, 25,() => {
            if (this.loading) {
                return
            }
            // послать запрос на сортировку сундука
            this.lastChange.type = CHEST_CHANGE.SORT
            this.lastChange.prevInventory = null // сервер применит текущее состояние инвентаря, предыдущее не нужно
            this.confirmAction()
            this.changeLoading = true
        })
    }

    // Обработчик открытия формы
    onShow(args : any) {
        this.lastChange.type = CHEST_CHANGE.NONE
        this.changeLoading = false
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
            this.inventory.sendStateChange({
                forget_chests: true
            })
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
            lastChange.type = CHEST_CHANGE.SLOTS;
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
    confirmAction(): void {
        this.fixAndValidateSlots('confirmAction')

        const that = this

        function extractOneChest(isFirst, info) {
            const res = { pos: info.pos, slots: {} };
            const range = ChestHelpers.getOneChestRange(isFirst, that.secondInfo != null, that.chest.slots.length);
            for(let i = range.min; i < range.max; i++) {
                let item = that.chest.slots[i]?.item;
                if (item) {
                    res.slots[i - range.min] = item;
                }
            }
            return res;
        }

        if (this.lastChange.type === CHEST_CHANGE.NONE) {
            return;
        }
        // Delay sending changes that don't affect the chest.
        if (this.lastChange.type === CHEST_CHANGE.SLOTS && !this.lastChange.slotInChest) {
            const now = performance.now();
            this.maxDirtyTime = this.maxDirtyTime ?? now + MAX_DIRTY_INVENTORY_DURATION;
            if (this.loading || this.maxDirtyTime > now) {
                return;
            }
        }
        // Here there may or may not be some change, described by this.lastChange or not.
        const params: TChestConfirmData = {
            chestSessionId:  this.chestSessionId,
            chest:           extractOneChest(true, this.info),
            inventory_slots: [ ...this.inventory.items ],
            change:          { ...this.lastChange }
        };
        if (this.secondInfo) {
            params.secondChest = extractOneChest(false, this.secondInfo);
        }
        // Send to server
        this.server.ChestConfirm(params);
        // Forget the previous inventory. If there are no changes, it won't be sent next time.
        this.lastChange.prevInventory = null;
        this.maxDirtyTime = null;
    }

    get loading() {
        return this.firstLoading || this.secondLoading || this.changeLoading
    }

    // Запрос содержимого сундука
    load(info: TChestInfo, secondInfo: TChestInfo | null = null) {
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

        this.onLoadingChanged()

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
        let isFirst = false;
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
        const range = ChestHelpers.getOneChestRange(isFirst, this.secondInfo != null, this.chest.slots.length)
        for(var i = range.min; i < range.max; i++) {
            // this.chest.slots[i].item = chest.slots[i - range.min] || null;
            this.chest.slots[i].setItem(chest.slots[i - range.min] || null)
        }
        this.fixAndValidateSlots('setData')
        this.onLoadingChanged()
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