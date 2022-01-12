import {BLOCK} from "../blocks.js";
import {Button, Label, Window} from "../../tools/gui/wm.js";
import {CraftTableInventorySlot} from "./base_craft_window.js";
import {ServerClient} from "../server_client.js";

export default class ChestWindow extends Window {

    constructor(x, y, w, h, id, title, text, inventory) {

        super(x, y, w, h, id, title, text);
        this.width *= this.zoom;
        this.height *= this.zoom;

        this.inventory  = inventory;
        this.loading    = false;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/form-chest.png');
        ct.hide();

        this.dragItem = null;

        // Ширина / высота слота
        this.cell_size = 36 * this.zoom;

        // Создание слотов сундука
        this.createChest(this.cell_size);
        
        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size);

        // Обработчик открытия формы
        this.onShow = function() {
            this.getRoot().center(this);
            Game.releaseMousePointer();
            Game.sounds.play(BLOCK.CHEST.sound, 'open');
        }
        
        // Обработчик закрытия формы
        this.onHide = function() {
            // Drag
            let dragItem = this.getRoot().drag.getItem();
            if(dragItem) {
                this.inventory.sendInventoryIncrement(dragItem.item);
            }
            this.getRoot().drag.clear();
            Game.sounds.play(BLOCK.CHEST.sound, 'close');
        }

        // Add labels to window
        ct.add(this.lbl1 = new Label(15 * this.zoom, 12 * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lbl1', null, 'Chest'));
        ct.add(new Label(15 * this.zoom, 147 * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lbl2', null, 'Inventory'));

        // Add listeners for server commands
        inventory.player.world.server.AddCmdListener([ServerClient.CMD_CHEST_CONTENT], (cmd) => {
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

    }

    draw(ctx, ax, ay) {
        this.parent.center(this);
        super.draw(ctx, ax, ay);
    }

    // Запрос содержимого сундука
    load(entity_id) {
        let that = this;
        this.lbl1.setText('LOADING...');
        this.entity_id  = entity_id;
        this.loading    = true;
        this.clear();
        Game.player.world.server.LoadChest(this.entity_id);
        setTimeout(function() {
            that.show();
        }, 50);
    }

    // Пришло содержимое сундука от сервера
    setData(chest) {
        // пришло содержимое другого сундука (не просматриваемого в данный момент)
        if(chest.item.entity_id != this.entity_id) {
            return;
        }
        this.lbl1.setText('CHEST');
        this.clear();
        for(let k of Object.keys(chest.slots)) {
            let item = chest.slots[k];
            let block = {...BLOCK.fromId(item.id)};
            block = Object.assign(block, item);
            this.chest.slots[k].setItem(block, true);
        }
    }
    
    // Отправка на сервер новых данных слота текущего сундука
    SendChestSlotItem(slot_index, item) {
        Game.player.world.server.SendChestSlotItem(this.entity_id, slot_index, {...item});
    }

    // Очистка слотов сундука от предметов
    clear() {
        for(let slot of this.chest.slots) {
            slot.item = null;
            // slot.setItem(null);
        }
    }

    /**
    * Создание слотов сундука
    * @param int sz Ширина / высота слота
    */
    createChest(sz) {
        const ct = this;
        if(ct.chest) {
            console.error('createCraftSlots() already created');
            return;
        }
        let sx          = 14 * this.zoom;
        let sy          = 34 * this.zoom;
        let xcnt        = 9;
        this.chest = {
            slots: []
        };
        for(let i = 0; i < 27; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * (36 * this.zoom), sz, sz, 'lblCraftChestSlot' + i, null, '' + i, this, null);
            lblSlot.index = i;
            lblSlot.is_chest_slot = true;
            lblSlot.onMouseEnter = function() {
                this.style.background.color = '#ffffff33';
            }
            lblSlot.onMouseLeave = function() {
                this.style.background.color = '#00000000';
            }
            // Перехват установки содержимого
            lblSlot.setItemOriginal = lblSlot.setItem;
            lblSlot.setItem = function(e, no_send_to_server) {
                // не разрешаем ничего делать, если сундук еще не загрузился
                if(this.parent.parent.loading) {
                    return;
                }
                this.setItemOriginal(e);
                if(!no_send_to_server) {
                    ct.SendChestSlotItem(this.index, this.getItem());
                }
            }
            // Перехват бросания на слот
            lblSlot.onDropOriginal = lblSlot.onDrop;
            lblSlot.onDrop = function(e) {
                // не разрешаем ничего делать, если сундук еще не загрузился
                if(this.parent.parent.loading) {
                    return;
                }
                this.onDropOriginal(e);
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
        // нижний ряд (видимые на хотбаре)
        let sx          = 14 * this.zoom;
        let sy          = 282 * this.zoom;
        let xcnt        = 9;
        for(let i = 0; i < 9; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * (36 * this.zoom), sz, sz, 'lblSlot' + (i), null, '' + i, this, i);
            ct.add(lblSlot);
            ct.inventory_slots.push(lblSlot);
        }
        sx              = 14 * this.zoom;
        sy              = 166 * this.zoom;
        xcnt            = 9;
        // верхние 3 ряда
        for(let i = 0; i < 27; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * (36 * this.zoom), sz, sz, 'lblSlot' + (i + 9), null, '' + (i + 9), this, i + 9);
            ct.add(lblSlot);
            ct.inventory_slots.push(lblSlot);
        }
    }

    getSlots() {
        return this.chest.slots;
    }

}