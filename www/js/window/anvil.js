import { BLOCK } from "../blocks.js";
import { Button, Label, TextEdit } from "../../tools/gui/wm.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";
import { CraftTableSlot, BaseCraftWindow } from "./base_craft_window.js";

//
class AnvilSlot extends CraftTableSlot {
    constructor(x, y, w, h, id, title, text, ct) {
        super(x, y, w, h, id, title, text, ct, null);
        
        this.ct = ct;

        this.onMouseEnter = function() {
            this.style.background.color = '#ffffff55';
            this.getResult();
        };

        this.onMouseLeave = function() {
            this.style.background.color = '#00000000';
            this.getResult();
        };
        
        this.onMouseDown = function(e) { 
            const dragItem = this.getItem();
            if (!dragItem) {
                return;
            }
            if (this == ct.result_slot) {
                this.getResult(true);
                ct.first_slot.setItem(null);
                ct.second_slot.setItem(null);
            }
            this.getInventory().setDragItem(this, dragItem, e.drag, this.width, this.height);
            this.setItem(null);
            this.getResult();
        };
        
        this.onDrop = function(e) {
            if (this == ct.result_slot) {
                return;
            }
            const dragItem = this.getItem();
            const dropItem = e.drag.getItem().item;
            if(!dropItem) {
                return;
            }
            this.setItem(dropItem, e);
            this.getInventory().setDragItem(this, dragItem, e.drag, this.width, this.height);
            
            // Если это первый слот
            if (this == ct.first_slot) {
                const block = BLOCK.fromId(dropItem.id);
                const label = (dropItem?.extra_data?.label) ? dropItem.extra_data.label : block.name;
                ct.lbl_edit.setEditText(label);
            }
            this.getResult();
        };
    }
    
    getInventory() {
        return this.ct.inventory;
    }
    
    getResult(create) {
        const first_item = this.ct.first_slot.getItem();
        const second_item = this.ct.second_slot.getItem();
        const label = this.ct.lbl_edit.buffer.join('');
        if (!first_item || first_item.count != 1) {
            this.ct.lbl_edit.buffer = [];
            this.ct.state = false;
            this.ct.result_slot.setItem(null);
        } else {
            if (!second_item) {
                if (!first_item?.extra_data?.label || first_item.extra_data.label != label) {
                    this.ct.state = true;
                    this.ct.result_slot.setItem(first_item);
                    if (create) {
                        const item = this.ct.result_slot.getItem();
                        if (!item?.extra_data) {
                            item.extra_data = {label: ""};
                        }
                        item.extra_data.label = label;
                        item.entity_id = first_item?.entity_id ?? randomUUID();
                        this.ct.lbl_edit.buffer = [];
                    }
                } else {
                    this.ct.state = false;
                    this.ct.result_slot.setItem(null);
                }
            } else {
                if (second_item.id == first_item.id) {
                    //to do починка
                    this.ct.state = true;
                    this.ct.result_slot.setItem(first_item);
                } else {
                    this.ct.state = false;
                    this.ct.result_slot.setItem(null);
                }
            }
        }
    }
    
}

//
export class AnvilWindow extends BaseCraftWindow {

    constructor(inventory) {
        
        super(10, 10, 350, 330, 'frmAnvil', null, null);
        
        this.width *= this.zoom;
        this.height *= this.zoom;
        this.style.background.image_size_mode = 'stretch';

        this.inventory = inventory;
        this.state = false;

        const options = {
            background: {
                image: './media/gui/anvil.png',
                image_size_mode: 'sprite',
                sprite: {
                    mode: 'stretch',
                    x: 0,
                    y: 0,
                    width: 350 * 2,
                    height: 330 * 2
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
        
        // Add labels to window
        ct.add(new Label(110 * this.zoom, 12 * this.zoom, 150 * this.zoom, 30 * this.zoom, 'lbl1', null, 'Repair & Name'));
        
        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom;
        
         // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size);
        
        // Создание слотов для крафта
        this.createCraft(this.cell_size);
        
        // Редактор названия предмета
        this.createEdit();
        
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
    
    createEdit() {
        
        const options = {
            background: {
                image: './media/gui/anvil.png',
                image_size_mode: 'sprite',
                sprite: {
                    mode: 'stretch',
                    x: 0,
                    y: 333 * 2,
                    width: 220 * 2,
                    height: 31 * 2
                }
            }
        };
        this.lbl_edit = new TextEdit(118 * this.zoom, 40 * this.zoom, 220 * this.zoom, 32 * this.zoom, 'lbl_edit', null, 'Hello, World!');
        // this.lbl_edit = new TextBox(this.zoom);
        this.lbl_edit.word_wrap         = false;
        this.lbl_edit.focused           = true;
        this.lbl_edit.max_length        = 19;
        this.lbl_edit.max_lines         = 1;
        this.lbl_edit.style.color       = '#ffffff';
        this.lbl_edit.style.font.size   *= this.zoom * 1.1;
        this.lbl_edit.style.background  = options.background;
        this.lbl_edit.setBackground(options.background.image);
        this.add(this.lbl_edit);
        
    }
    
    createCraft(cell_size) {
        
        this.first_slot = new AnvilSlot(52 * this.zoom, 91 * this.zoom, cell_size, cell_size, 'lblAnvilFirstSlot', null, null, this);
        this.second_slot = new AnvilSlot(150 * this.zoom, 91 * this.zoom, cell_size, cell_size, 'lblAnvilSecondSlot', null, null, this);
        this.result_slot = new AnvilSlot(266 * this.zoom, 91 * this.zoom, cell_size, cell_size, 'lblAnvilResultSlot', null, null, this);
        this.add(this.first_slot);
        this.add(this.second_slot);
        this.add(this.result_slot);
        
    }
    
    draw(ctx, ax, ay) {
        super.draw(ctx, ax, ay);
        if(!this.state) {
            if(typeof this.style.background.image == 'object') {
                const x = ax + this.x;
                const y = ay + this.y;
                const arrow = {x: 704, y: 0, width: 112, height: 80, tox: 198 * this.zoom, toy: 88 * this.zoom};
                ctx.drawImage(
                    this.style.background.image,
                    arrow.x,
                    arrow.y,
                    arrow.width,
                    arrow.height,
                    x + arrow.tox,
                    y + arrow.toy,
                    arrow.width * this.zoom / 2,
                    arrow.height * this.zoom / 2
                );
            }
        }
        
    }
    
}

