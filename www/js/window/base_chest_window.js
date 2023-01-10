import { ArrayHelpers, ObjectHelpers, Vector } from "../helpers.js";
import { BLOCK } from "../blocks.js";
import { Button, Label } from "../../tools/gui/wm.js";
import { CraftTableInventorySlot } from "./base_craft_window.js";
import { ServerClient } from "../server_client.js";
import { DEFAULT_CHEST_SLOT_COUNT, INVENTORY_HOTBAR_SLOT_COUNT, INVENTORY_SLOT_SIZE, 
    INVENTORY_VISIBLE_SLOT_COUNT, INVENTORY_DRAG_SLOT_INDEX,
    CHEST_INTERACTION_MARGIN_BLOCKS, MAX_DIRTY_INVENTORY_DURATION
} from "../constant.js";
import { INVENTORY_CHANGE_NONE, INVENTORY_CHANGE_SLOTS, 
    INVENTORY_CHANGE_CLOSE_WINDOW } from "../inventory.js";
import { ChestHelpers, isBlockRoughlyWithinPickatRange } from "../block_helpers.js"
import { Lang } from "../lang.js";
import { BaseInventoryWindow } from "./base_inventory_window.js"

export class BaseChestWindow extends BaseInventoryWindow {

    constructor(x, y, w, h, id, title, text, inventory, options) {

        super(x, y, w, h, id, title, text, inventory);

        this.options = options;
        this.width *= this.zoom;
        this.height *= this.zoom;
        this.style.background = {...this.style.background, ...options.background}

        this.firstLoading  = false;
        this.secondLoading = false;
        this.timeout    = null;
        this.maxDirtyTime  = null;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.setBackground(options.background.image);
        ct.hide();

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;

        // Создание слотов
        this.createSlots(this.prepareSlots());
        
        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size, h);
        
        this.lastChange = {
            type: INVENTORY_CHANGE_NONE,
            // the slots are ignored when (type == INVENTORY_CHANGE_CLOSE_WINDOW)
            slotIndex: -1,
            slotInChest: false,
            slotPrevItem: null,
            dragPrevItem: null,
            prevInventory: null
        }
        // A random number. If it's null, no confirmation is reqested when closing.
        this.chestSessionId = null;

        this.blockModifierListener = (tblock) => {
            let targetInfo;
            const posworld = tblock.posworld;
            if (this.info.pos.equal(posworld)) {
                targetInfo = this.info;
            } else if (this.secondInfo && this.secondInfo.pos.equal(posworld)) {
                targetInfo = this.secondInfo;
            } else {
                return;
            }
            // If a chest was removed by the server
            if (tblock.id !== targetInfo.block_id) {
                this.hideAndSetupMousePointer(); // It also takes care of the dragged item.
                return;
            }
            const mat = tblock.material;
            if (!(mat.chest.private || mat.id === BLOCK.ENDER_CHEST.id)) {
                this.setLocalData(tblock);
            }
        };

        // Обработчик открытия формы
        this.onShow = function() {
            this.lastChange.type = INVENTORY_CHANGE_NONE;
            this.getRoot().center(this);
            Qubatch.releaseMousePointer();
            if(options.sound.open) {
                Qubatch.sounds.play(options.sound.open.tag, options.sound.open.action);
            }
            this.world.blockModifierListeners.push(this.blockModifierListener);
        }

        // Обработчик закрытия формы
        this.onHide = function(wasVisible) {
            if (this.chestSessionId != null) { // if the closing wasn't forced by the server
                this.lastChange.type = INVENTORY_CHANGE_CLOSE_WINDOW;
                // Перекидываем таскаемый айтем в инвентарь, чтобы не потерять его
                // @todo Обязательно надо проработать кейс, когда в инвентаре нет места для этого айтема
                this.inventory.clearDragItem(true);
                this.confirmAction();
            }
            if(wasVisible && options.sound.close) {
                Qubatch.sounds.play(options.sound.close.tag, options.sound.close.action);
            }
            this.info = null; // disables AddCmdListener listeners 
            ArrayHelpers.fastDeleteValue(this.world.blockModifierListeners, this.blockModifierListener);
        }

        // Add labels to window
        ct.add(this.lbl1 = new Label(15 * this.zoom, 12 * this.zoom, 200 * this.zoom, 30 * this.zoom, 'lbl1', null, options.title));
        ct.add(new Label(15 * this.zoom, (h + (147 - 332)) * this.zoom, 200 * this.zoom, 30 * this.zoom, 'lbl2', null, 'Inventory'));

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
        });

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const ct = this;
            // Close button
            let btnClose = new Button(ct.width - 34 * this.zoom, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial';
            btnClose.style.background.image = image;
            btnClose.style.background.image_size_mode = 'stretch';
            btnClose.onDrop = btnClose.onMouseDown = function(e) {
                ct.hide();
            }
            ct.add(btnClose);
        });

        // Catch action
        this.catchActions();

        // Hook for keyboard input
        this.onKeyEvent = (e) => {
            const {keyCode, down, first} = e;
            switch(keyCode) {
                case KEY.E:
                case KEY.ESC: {
                    if(!down) {
                        ct.hideAndSetupMousePointer();
                    }
                    return true;
                }
            }
            return false;
        }

        // Updates drag UI if the dragged item changed
        this.onInventorySetState = function() {
            const inventory = Qubatch.player.inventory;
            const prevDragItem = Qubatch.hud.wm.drag.getItem();
            const newDargItem = inventory.items[INVENTORY_DRAG_SLOT_INDEX];
            if (newDargItem) {
                // update it, in case it changed
                const anySlot = this.inventory_slots[0]; // it's used only for getting size and drawing
                inventory.setDragItem(anySlot, newDargItem, Qubatch.hud.wm.drag, anySlot.width, anySlot.height);
            } else if (prevDragItem) {
                Qubatch.hud.wm.drag.clear();
            }
        }
    }

    // Catch action
    catchActions() {

        // Remembers two affected slots before a user action is executed.
        function updateLastChangeSlots(craftSlot) {
            const lastChange = craftSlot.parent.lastChange;
            lastChange.type = INVENTORY_CHANGE_SLOTS;
            lastChange.slotIndex = craftSlot.getIndex();
            lastChange.slotInChest = craftSlot.is_chest_slot;
            const item = craftSlot.getItem();
            lastChange.slotPrevItem = item ? { ...item } : null;
            const dargItem = Qubatch.player.inventory.items[INVENTORY_DRAG_SLOT_INDEX];
            lastChange.dragPrevItem = dargItem ? { ...dargItem } : null;
            // We need only shallow copies of elements (to preserve count)
            lastChange.prevInventory = ObjectHelpers.deepClone(Qubatch.player.inventory.items, 2);
        }

        //
        const handlerMouseDown = function(e) {
            updateLastChangeSlots(this);
            this._originalMouseDown(e);
            this.parent.confirmAction();
        };
        //
        const handlerOnDrop = function(e) {
            updateLastChangeSlots(this);
            this._originalOnDrop(e);
            this.parent.confirmAction();
        };
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

        const that = this;

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
        };
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

    draw(ctx, ax, ay) {
        this.parent.center(this);
        super.draw(ctx, ax, ay);
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
            this.lbl1.setText(this.options.title);
        }
        // copy data slots to the UI slots
        const range = ChestHelpers.getOneChestRange(isFirst, this.secondInfo, this.chest.slots.length);
        for(var i = range.min; i < range.max; i++) {
            this.chest.slots[i].item = chest.slots[i - range.min] || null;
        }
    }

    // Очистка слотов сундука от предметов
    clear() {
        for(let slot of this.chest.slots) {
            slot.item = null; // slot.setItem(null);
        }
    }

    // Prepare slots based on specific window type
    prepareSlots(count = DEFAULT_CHEST_SLOT_COUNT) {
        const resp  = [];
        const xcnt  = 9;
        const sx    = 14 * this.zoom;
        const sy    = 34 * this.zoom;
        const sz    = this.cell_size;
        for(let i = 0; i < count; i++) {
            const pos = new Vector(
                sx + (i % xcnt) * sz,
                sy + Math.floor(i / xcnt) * (INVENTORY_SLOT_SIZE * this.zoom),
                0
            );
            resp.push({pos});
        }
        return resp;
    }

    /**
    * Creates chest slots.
    * @param {Array} slots_info - the array of {x, y} objects - slot positions on
    *   the screen. It's the value retuned by {@link prepareSlots}
    */
    createSlots(slots_info) {
        const ct = this;
        if(ct.chest) {
            console.error('createCraftSlots() already created');
            return;
        }
        let sz = this.cell_size;
        this.chest = {
            slots: []
        };
        for(let i in slots_info) {
            const info = slots_info[i];
            const options = {
                readonly: info.readonly,
                disableIfLoading: true,
                onMouseEnterBackroundColor: '#ffffff33'
            };
            let lblSlot = new CraftTableInventorySlot(info.pos.x, info.pos.y, sz, sz,
                'lblCraftChestSlot' + i, null, '' + i, this, null, options);
            lblSlot.index = i;
            lblSlot.is_chest_slot = true;
            this.chest.slots.push(lblSlot);
            ct.add(lblSlot);
        }
    }

    /**
    * Создание слотов для инвентаря
    * @param int sz Ширина / высота слота
    */
    createInventorySlots(sz, baseWindowH) {
        const ct = this;
        if(ct.inventory_slots) {
            console.error('createInventorySlots() already created');
            return;
        }
        ct.inventory_slots  = [];
        const xcnt = INVENTORY_HOTBAR_SLOT_COUNT;
        // нижний ряд (видимые на хотбаре)
        let sx = 14 * this.zoom;
        let sy = (baseWindowH + (282 - 332))* this.zoom;
        for(let i = 0; i < INVENTORY_HOTBAR_SLOT_COUNT; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * (INVENTORY_SLOT_SIZE * this.zoom), sz, sz,
                'lblSlot' + (i), null, '' + i, this, i);
            ct.add(lblSlot);
            ct.inventory_slots.push(lblSlot);
        }
        // верхние 3 ряда
        sx = 14 * this.zoom;
        sy = (baseWindowH + (166 - 332)) * this.zoom;
        for(let i = 0; i < INVENTORY_VISIBLE_SLOT_COUNT - INVENTORY_HOTBAR_SLOT_COUNT; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * (INVENTORY_SLOT_SIZE * this.zoom), sz, sz,
                'lblSlot' + (i + 9), null, '' + (i + 9), this, i + 9);
            ct.add(lblSlot);
            ct.inventory_slots.push(lblSlot);
        }
    }

    getSlots() {
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
}