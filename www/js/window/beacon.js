import { BLOCK } from "../blocks.js";
import { Button, Label, TextEdit } from "../../tools/gui/wm.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";
import { CraftTableSlot, BaseCraftWindow } from "./base_craft_window.js";


//
export class BeaconWindow extends BaseCraftWindow {

    constructor(inventory) {
        let n = 1;
        super(10, 10, 459/n, 438/n, 'frmBeacon', null, null);
        
        this.width *= this.zoom;
        this.height *= this.zoom;
        this.style.background.image_size_mode = 'stretch';

        this.inventory = inventory;
        this.state = false;

        const options = {
            background: {
                image: './media/gui/beacon.png',
                image_size_mode: 'sprite',
                sprite: {
                    mode: 'stretch',
                    x: 0,
                    y: 0,
                    width: 459/n,
                    height: 438/n
                }
            }
        };
        this.style.background = {...this.style.background, ...options.background};

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.setBackground(options.background.image);
        ct.hide();
        
        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;
        
         // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size);
        
        // Обработчик закрытия формы
        this.onHide = function() {
            this.inventory.clearDragItem();
            // Save inventory
            Qubatch.world.server.InventoryNewState(this.inventory.exportItems(), []);
        }
        
        // Обработчик открытия формы
        this.onShow = function() {
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
            btnClose.onDrop = btnClose.onMouseDown = function(e) {
                ct.hide();
            }
            ct.add(btnClose);
        });

        // Hook for keyboard input
        this.onKeyEvent = (e) => {
            const {keyCode, down, first} = e;
            switch(keyCode) {
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
    }
    
}

