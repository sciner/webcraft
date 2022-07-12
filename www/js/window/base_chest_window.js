import { Vector } from "../helpers.js";
import { Button, Label, Window } from "../../tools/gui/wm.js";
import { CraftTableInventorySlot } from "./base_craft_window.js";
import { ServerClient } from "../server_client.js";
import { DEFAULT_CHEST_SLOT_COUNT, INVENTORY_HOTBAR_SLOT_COUNT, INVENTORY_SLOT_SIZE, INVENTORY_VISIBLE_SLOT_COUNT } from "../constant.js";

export class BaseChestWindow extends Window {

    constructor(x, y, w, h, id, title, text, inventory, options) {

        super(x, y, w, h, id, title, text);

        this.options = options;
        this.width *= this.zoom;
        this.height *= this.zoom;
        this.style.background = {...this.style.background, ...options.background}

        this.server     = inventory.player.world.server;
        this.inventory  = inventory;
        this.loading    = false;

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
        this.createInventorySlots(this.cell_size);

        // Обработчик открытия формы
        this.onShow = function() {
            this.getRoot().center(this);
            Game.releaseMousePointer();
            if(options.sound.open) {
                Game.sounds.play(options.sound.open.tag, options.sound.open.action);
            }
        }

        // Обработчик закрытия формы
        this.onHide = function() {
            // Перекидываем таскаемый айтем в инвентарь, чтобы не потерять его
            // @todo Обязательно надо проработать кейс, когда в инвентаре нет места для этого айтема
            this.inventory.clearDragItem(true);
            this.confirmAction();
            if(options.sound.close) {
                Game.sounds.play(options.sound.close.tag, options.sound.close.action);
            }
        }

        // Add labels to window
        ct.add(this.lbl1 = new Label(15 * this.zoom, 12 * this.zoom, 200 * this.zoom, 30 * this.zoom, 'lbl1', null, options.title));
        ct.add(new Label(15 * this.zoom, 147 * this.zoom, 200 * this.zoom, 30 * this.zoom, 'lbl2', null, 'Inventory'));

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
                            Game.setupMousePointer(true);
                        } catch(e) {
                            console.error(e);
                        }
                    }
                    return true;
                }
            }
            return false;
        }

    }

    // Catch action
    catchActions() {
        //
        const handlerMouseDown = function(e) {
            this._originalMouseDown(e);
            this.parent.confirmAction();
        };
        //
        const handlerOnDrop = function(e) {
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
        const params = {
            chest:           {pos: this.info.pos, slots: {}},
            inventory_slots: new Array(this.inventory.items.length)
        };
        // chest
        for(let k in this.chest.slots) {
            let slot = this.chest.slots[k];
            if(slot.item) {
                params.chest.slots[k] = slot.item;
            }
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
    load(info) {
        let that = this;
        this.lbl1.setText('LOADING...');
        this.info = info;
        this.loading = true;
        this.clear();
        this.server.LoadChest(info);
        setTimeout(function() {
            that.show();
        }, 50);
    }

    // Пришло содержимое сундука от сервера
    setData(chest) {
        if(!this.info) {
            return;
        }
        // пришло содержимое другого сундука (не просматриваемого в данный момент)
        if(!this.info.pos.equal(chest.pos)) {
            return;
        }
        //
        if(this.loading) {
            this.loading = false;
            this.inventory.player.clearEvents();
        }
        //
        this.lbl1.setText(this.options.title);
        this.clear();
        this.state = chest?.state || null;
        for(let k of Object.keys(chest.slots)) {
            let item = chest.slots[k];
            if(!item) {
                continue;
            }
            if(!(k in this.chest.slots)) {
                continue;
            }
            this.chest.slots[k].setItem(item, null, true);
        }
    }

    // Очистка слотов сундука от предметов
    clear() {
        for(let slot of this.chest.slots) {
            slot.item = null; // slot.setItem(null);
        }
    }

    // Prepare slots based on specific window type
    prepareSlots() {
        const resp  = [];
        const count = DEFAULT_CHEST_SLOT_COUNT;
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
    createInventorySlots(sz) {
        const ct = this;
        if(ct.inventory_slots) {
            console.error('createInventorySlots() already created');
            return;
        }
        ct.inventory_slots  = [];
        const xcnt = INVENTORY_HOTBAR_SLOT_COUNT;
        // нижний ряд (видимые на хотбаре)
        let sx = 14 * this.zoom;
        let sy = 282 * this.zoom;
        for(let i = 0; i < INVENTORY_HOTBAR_SLOT_COUNT; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * (INVENTORY_SLOT_SIZE * this.zoom), sz, sz, 'lblSlot' + (i), null, '' + i, this, i);
            ct.add(lblSlot);
            ct.inventory_slots.push(lblSlot);
        }
        // верхние 3 ряда
        sx = 14 * this.zoom;
        sy = 166 * this.zoom;
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