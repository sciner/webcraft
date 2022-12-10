import { ArrayHelpers, Vector } from "../helpers.js";
import { Button, Label, Window } from "../../tools/gui/wm.js";
import { CraftTableInventorySlot } from "./base_craft_window.js";
import { ServerClient } from "../server_client.js";
import { DEFAULT_CHEST_SLOT_COUNT, INVENTORY_HOTBAR_SLOT_COUNT, INVENTORY_SLOT_SIZE, 
    INVENTORY_VISIBLE_SLOT_COUNT, INVENTORY_DRAG_SLOT_INDEX 
} from "../constant.js";
import { INVENTORY_CHANGE_NONE, INVENTORY_CHANGE_SLOTS, 
    INVENTORY_CHANGE_CLEAR_DRAG_ITEM } from "../inventory.js";
import { ChestHelpers } from "../block_helpers.js"

export class BaseChestWindow extends Window {

    constructor(x, y, w, h, id, title, text, inventory, options) {

        super(x, y, w, h, id, title, text);

        this.options = options;
        this.width *= this.zoom;
        this.height *= this.zoom;
        this.style.background = {...this.style.background, ...options.background}

        this.world      = inventory.player.world;
        this.server     = this.world.server;
        this.inventory  = inventory;
        this.loading    = false;
        this.secondLoading = false;

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
            // the slots are ignored when (type == INVENTORY_CHANGE_CLEAR_DRAG_ITEM)
            slotIndex: -1,
            slotInChest: false,
            slotPrevItem: null,
            dragPrevItem: null
        }

        this.blockModifierListener = (tblock) => {
            // If a chest was removed by the server
            if (this.info.pos.equal(tblock.posworld) && tblock.id !== this.info.block_id ||
                this.secondInfo && this.secondInfo.pos.equal(tblock.posworld) && 
                tblock.id !== this.secondInfo.block_id
            ) {
                this.hide(); // It also takes care of the dragged item.
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
        this.onHide = function() {
            this.lastChange.type = INVENTORY_CHANGE_CLEAR_DRAG_ITEM;
            // Перекидываем таскаемый айтем в инвентарь, чтобы не потерять его
            // @todo Обязательно надо проработать кейс, когда в инвентаре нет места для этого айтема
            this.inventory.clearDragItem(true);
            this.confirmAction();
            if(options.sound.close) {
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
                        ct.hide();
                        try {
                            Qubatch.setupMousePointer(true);
                        } catch(e) {
                            console.error(e);
                        }
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
                if (prevDragItem == null || newDargItem.id != prevDragItem.id) {
                    const anySlot = this.inventory_slots[0]; // it's used only for getting size and crawing
                    inventory.setDragItem(anySlot, newDargItem, Qubatch.hud.wm.drag, anySlot.width, anySlot.height);
                }
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
            // We know that there is no change - a user action was analyzed and it does nothing.
            return;
        }
        // Here there may or may not be some change, described by this.lastChange or not.
        const params = {
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
    }

    draw(ctx, ax, ay) {
        this.parent.center(this);
        super.draw(ctx, ax, ay);
    }

    // Запрос содержимого сундука
    load(info, secondInfo = null) {
        let that = this;
        this.lbl1.setText('LOADING...');
        this.clear();
        this.info = info;
        this.loading = true;
        this.server.LoadChest(info);
        this.secondInfo = secondInfo;
        this.secondLoading = secondInfo != null;
        if (secondInfo) {
            this.server.LoadChest(secondInfo);
        }
        setTimeout(function() {
            that.show();
        }, 50);
    }

    // Пришло содержимое сундука от сервера
    setData(chest) {
        if (!this.info) {
            return;
        }
        var isFirst = false;
        const wasLoading = this.loading || this.secondLoading;
        if (this.info.pos.equal(chest.pos)) {
            this.loading = false;
            this.state = chest?.state || null;
            isFirst = true;
        } else if (this.secondInfo && this.secondInfo.pos.equal(chest.pos)) {
            this.secondLoading = false;
        } else {
            // пришло содержимое другого сундука (не просматриваемого в данный момент)
            return;
        }
        //
        if (wasLoading && !this.loading && !this.secondLoading) {
            this.inventory.player.stopAllActivity();
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
    * Create chest slots
    * @param int sz Ширина / высота слота
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
            const readonly = !!info.readonly;
            let lblSlot = new CraftTableInventorySlot(info.pos.x, info.pos.y, sz, sz, 'lblCraftChestSlot' + i, null, '' + i, this, null, readonly);
            lblSlot.index = i;
            lblSlot.is_chest_slot = true;
            lblSlot.onMouseEnter = function() {
                this.style.background.color = '#ffffff33';
            }
            lblSlot.onMouseLeave = function() {
                this.style.background.color = '#00000000';
            }
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
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * (INVENTORY_SLOT_SIZE * this.zoom), sz, sz, 'lblSlot' + (i), null, '' + i, this, i);
            ct.add(lblSlot);
            ct.inventory_slots.push(lblSlot);
        }
        // верхние 3 ряда
        sx = 14 * this.zoom;
        sy = (baseWindowH + (166 - 332)) * this.zoom;
        for(let i = 0; i < INVENTORY_VISIBLE_SLOT_COUNT - INVENTORY_HOTBAR_SLOT_COUNT; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * (INVENTORY_SLOT_SIZE * this.zoom), sz, sz, 'lblSlot' + (i + 9), null, '' + (i + 9), this, i + 9);
            ct.add(lblSlot);
            ct.inventory_slots.push(lblSlot);
        }
    }

    getSlots() {
        return this.chest.slots;
    }

}