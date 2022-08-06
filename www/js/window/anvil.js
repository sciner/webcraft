import {BLOCK} from "../blocks.js";
import { Vector } from "../helpers.js";
import { BaseChestWindow } from "./base_chest_window.js";
import { Button, Label, Window } from "../../tools/gui/wm.js";
import { DEFAULT_CHEST_SLOT_COUNT, INVENTORY_HOTBAR_SLOT_COUNT, INVENTORY_SLOT_SIZE, INVENTORY_VISIBLE_SLOT_COUNT } from "../constant.js";
import { CraftTableInventorySlot, CraftTableSlot } from "./base_craft_window.js";


/*export class AnvilWindow extends BaseChestWindow {

    constructor(inventory) {

        super(10, 10, 352, 332, 'frmAnvil', null, null, inventory, {
            title: 'Charging station',
            background: {
                image: './media/gui/anvil.png',
                image_size_mode: 'sprite',
                sprite: {
                    mode: 'stretch',
                    x: 0,
                    y: 0,
                    width: 351,
                    height: 331
                }
            },
            sound: {
                open: {tag: BLOCK.CHARGING_STATION.sound, action: 'open'},
                close: {tag: BLOCK.CHARGING_STATION.sound, action: 'close'}
            }
        });
        
        const ct = this;
        ct.add(this.lbl1 = new Label(15 * this.zoom, 12 * this.zoom, 200 * this.zoom, 30 * this.zoom, 'lbl1', null, "sdfsdfwerewrsdf"));

    }
    
    prepareSlots() {
        const resp          = [];
        
        resp.push({pos: new Vector(52 * this.zoom, 92 * this.zoom, 0)});

        return resp;
    }
}*/

export class AnvilWindow extends Window {

    constructor(inventory) {
        
        console.log(inventory);
        
        super(0, 0, 351, 351, 'frmAnvil', null, null);
        
        this.width *= this.zoom;
        this.height *= this.zoom;
        this.inventory  = inventory;
       
         // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.style.background.image_size_mode = 'sprite';
        ct.style.background.sprite = {
            mode: 'stretch',
            x: 0,
            y: 0,
            width: 351,
            height: 331
        };
        ct.setBackground('./media/gui/anvil.png');
        ct.hide();
        
        
       // // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;
        
        // Создание слотов
       // this.createSlots(this.prepareSlots());
        
        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size);
        
        // Обработчик открытия формы
        this.onShow = function() {
            this.getRoot().center(this);
            Qubatch.releaseMousePointer();
        }
        
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
    
    
    createInventorySlots(sz) {
        const ct = this;
        if(ct.inventory_slots) {
            console.info('createInventorySlots() already created');
            return;
        }
        ct.inventory_slots  = [];
        const xcnt = INVENTORY_HOTBAR_SLOT_COUNT;
        // нижний ряд (видимые на хотбаре)
        let sx = 14 * this.zoom;
        let sy = 282 * this.zoom;
        for(let i = 0; i < INVENTORY_HOTBAR_SLOT_COUNT; i++) {
            let lblSlot = new CraftTableInventorySlot(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * (INVENTORY_SLOT_SIZE * this.zoom), sz, sz, 'lblSlot' + (i), null, '' + (i), this, i);
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
}