import {BLOCK} from "../blocks.js";
import {Button, Label, Window} from "../../tools/gui/wm.js";
import {BaseCraftWindow, CraftTableInventorySlot} from "./base_craft_window.js";
import {ServerClient} from "../server_client.js";

export default class FurnaceWindow extends BaseCraftWindow {

    constructor(x, y, w, h, id, title, text, inventory) {

        super(x, y, w, h, id, title, text);

        this.width *= this.zoom;
        this.height *= this.zoom;
        this.style.background.image_size_mode = 'stretch';

        this.server     = inventory.player.world.server;
        this.inventory  = inventory;
        this.loading    = false;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/form-furnace.png');
        ct.hide();

        this.dragItem = null;

        // Ширина / высота слота
        this.cell_size = 36 * this.zoom;

        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size);

        // Итоговый слот (то, что мы получим)
        this.createResultSlot(230 * this.zoom, 68 * this.zoom);

        // Обработчик открытия формы
        this.onShow = function() {
            this.getRoot().center(this);
            Game.releaseMousePointer();
            // Game.sounds.play(BLOCK.CHEST.sound, 'open');
        }

        // Обработчик закрытия формы
        this.onHide = function() {
            // Перекидываем таскаемый айтем в инвентарь, чтобы не потерять его
            // @todo Обязательно надо проработать кейс, когда в инвентаре нет места для этого айтема
            let dragItem = this.getRoot().drag.getItem();
            if(dragItem) {
                this.inventory.increment(dragItem.item);
            }
            this.getRoot().drag.clear();
            this.confirmAction();
            // Game.sounds.play(BLOCK.CHEST.sound, 'close');
        }

        // Add labels to window
        ct.add(this.lbl1 = new Label(15 * this.zoom, 12 * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lbl1', null, 'Furnace'));
        ct.add(new Label(15 * this.zoom, 147 * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lbl2', null, 'Inventory'));

        // Add listeners for server commands
        this.server.AddCmdListener([ServerClient.CMD_FURNACE_CONTENT], (cmd) => {
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

    }

    // Catch action
    catchActions() {
        /*
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
        */
    }

    // Confirm action
    confirmAction() {
        /*
        const params = {
            drag_item: Game.hud.wm.drag?.item?.item,
            furnace: {entity_id: this.entity_id, slots: {}},
            inventory_slots: []
        };
        params.drag_item = params.drag_item ? BLOCK.convertItemToInventoryItem(params.drag_item) : null;
        // inventory
        for(let slot of this.inventory_slots) {
            let item = slot.getItem();
            params.inventory_slots.push(item ? BLOCK.convertItemToInventoryItem(item) : null);
        }
        // Send to server
        this.server.ChestConfirm(params);
        */
    }

    draw(ctx, ax, ay) {
        this.parent.center(this);
        super.draw(ctx, ax, ay);
    }

    // Запрос содержимого
    load(entity_id) {
        let that = this;
        this.lbl1.setText('LOADING...');
        this.entity_id  = entity_id;
        this.loading    = true;
        this.clear();
        this.server.LoadFurnace(this.entity_id);
        setTimeout(function() {
            that.show();
        }, 50);
    }

    // Пришло содержимое печки от сервера
    setData(entity) {
        // пришло содержимое другой печки (не просматриваемой в данный момент)
        if(entity.item.entity_id != this.entity_id) {
            return;
        }
        this.lbl1.setText('FURNACE');
        this.clear();
        // @todo Apply new slots state
    }

    // Очистка
    clear() {}

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
        return [];
    }

}