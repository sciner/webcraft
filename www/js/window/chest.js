import {Window, Label, Button} from "../../tools/gui/wm.js";
import {CraftTableInventorySlot} from "./craft_table.js";
import {BLOCK} from "../blocks.js";

export default class ChestWindow extends Window {

    constructor(x, y, w, h, id, title, text, inventory) {

        super(x, y, w, h, id, title, text);

        this.inventory  = inventory;
        this.loading    = false;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/form-chest.png');
        ct.hide();

        // Add buttons
        this.addCloseButton();

        this.dragItem = null;

        // Add buttons
        this.addCloseButton();
        // this.addRecipesButton();

        // Ширина / высота слота
        this.cell_size = 36;

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
                this.inventory.increment(dragItem.item);
            }
            this.getRoot().drag.clear();
            Game.sounds.play(BLOCK.CHEST.sound, 'close');
        }

        // Add labels to window
        ct.add(this.lbl1 = new Label(15, 12, 80, 30, 'lbl1', null, 'Chest'));
        ct.add(new Label(15, 147, 80, 30, 'lbl2', null, 'Inventory'));

    }

    draw(ctx, ax, ay) {
        this.parent.center(this);
        super.draw(ctx, ax, ay);
    }

    addCloseButton() {
        const ct = this;
        // Close button
        let btnClose = new Button(ct.width - 34, 9, 20, 20, 'btnClose', '×');
        btnClose.onDrop = btnClose.onMouseDown = function(e) {
            ct.hide();
        }
        ct.add(btnClose);
    }

    // Запрос содержимого сундука
    load(block) {
        let that = this;
        this.lbl1.setText('LOADING...');
        console.table(block);
        this.entity_id  = block.entity_id;
        this.loading    = true;
        this.clear();
        Game.world.server.LoadChest(block.entity_id);
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
            this.chest.slots[k].setItem(block);
        }
    }
    
    // Отправка на сервер новых данных слота текущего сундука
    SendChestSlotItem(slot_index, item) {
        Game.world.server.SendChestSlotItem(this.entity_id, slot_index, item);
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
        let sx          = 14;
        let sy          = 34;
        let xcnt        = 9;
        this.chest = {
            slots: []
        };
        for(let i = 0; i < 27; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * 36, sz, sz, 'lblCraftChestSlot' + i, null, '' + i, this, null);
            lblSlot.index = i;
            lblSlot.onMouseEnter = function() {
                this.style.background.color = '#ffffff33';
            }
            lblSlot.onMouseLeave = function() {
                this.style.background.color = '#00000000';
            }
            // Перехват установки содержимого
            lblSlot.setItemOriginal = lblSlot.setItem;
            lblSlot.setItem = function(e) {
                // не разрешаем ничего делать, если сундук еще не загрузился
                if(this.parent.parent.loading) {
                    return;
                }
                this.setItemOriginal(e);
                ct.SendChestSlotItem(this.index, this.getItem());
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
        let sx          = 14;
        let sy          = 282;
        let xcnt        = 9;
        for(let i = 0; i < 9; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * 36, sz, sz, 'lblSlot' + (i), null, '' + i, this, i);
            ct.add(lblSlot);
            ct.inventory_slots.push(lblSlot);
        }
        sx              = 14;
        sy              = 166;
        xcnt            = 9;
        // верхние 3 ряда
        for(let i = 0; i < 27; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * 36, sz, sz, 'lblSlot' + (i + 9), null, '' + (i + 9), this, i + 9);
            ct.add(lblSlot);
            ct.inventory_slots.push(lblSlot);
        }
    }

}