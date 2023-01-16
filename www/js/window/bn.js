import { BLOCK } from "../blocks.js";
import { Button, Window } from "../../tools/gui/wm.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";
import { CraftTableSlot, BaseCraftWindow } from "./base_craft_window.js";

// слот для залога
class BeaconSlot extends CraftTableSlot {
    
    constructor(x, y, w, h, id, title, text, ct) {
        super(x, y, w, h, id, title, text, ct, null);
        
        this.ct = ct;
        
        this.onMouseEnter = function() {
            this.style.background.color = '#ffffff55';
        };

        this.onMouseLeave = function() {
            this.style.background.color = '#00000000';
        };
        
        this.onMouseDown = function(e) { 
            const dragItem = this.getItem();
            if (!dragItem) {
                return;
            }
            this.getInventory().setDragItem(this, dragItem, e.drag, this.width, this.height);
            this.setItem(null);
        };
        
        this.onDrop = function(e) {
            const dropItem = e.drag.getItem().item;
            // в слот можно вставлять только алмаз, изумруд, золото, железо, незерит
            if (!dropItem || dropItem.count != 1 || ![BLOCK.GOLD_INGOT.id, BLOCK.DIAMOND.id, BLOCK.IRON_INGOT.id, BLOCK.NETHER_BRICK.id].includes(dropItem.id)) {
                return;
            }
            const dragItem = this.getItem();
            this.setItem(dropItem, e);
            this.getInventory().setDragItem(this, dragItem, e.drag, this.width, this.height);
        };
    }
    
    getInventory() {
        return this.ct.inventory;
    }
    
}

// кнопки активации
class ActiveButton extends Window {
    
    constructor(x, y, size, id, icon, ct) {
        
        super(x, y, size, size, id, null, null);
        
        this.ct = ct;
        this.style.background.image = './media/gui/bn.png';
        this.style.border.hidden = true;
        this.style.background.sprite = {
            'mode': 'stretch',
            'width': 43,
            'height': 43,
            'x': 0,
            'y': 438
        };
        this.setBackground(this.style.background.image, 'sprite');
        this.style.icon.image = './media/gui/bn.png';
        this.style.icon.sprite = {
            'mode': 'stretch',
            'width': 43,
            'height': 43,
            'x': 1,
            'y': 438
        };
        this.setIconImage(this.style.icon.image, 'sprite');

        this.setIcon(icon);
        this.setEnable(true);
        this.setDown(false);
        
        this.onMouseEnter = function() {
            if (this.enable && !this.down) {
                this.style.background.sprite.x = 132;
            }
        };
        
        this.onMouseLeave = function() {
            if (this.enable && !this.down) {
                this.style.background.sprite.x = 0;
            }
        };
        
        this.onMouseDown = function() {
            if (this.enable && !this.down) {
                this.ct.btn_ok.setDown(false);
                this.ct.btn_cancel.setDown(false);
                this.setDown(true);
            }
        };
    }
    
    setEnable(val) {
        this.enable = val;
        if (!this.enable) {
            this.style.background.sprite.x = 88;
        }
    }
    
    setDown(val) {
        this.down = val;
        this.style.background.sprite.x = this.down ? 43 : 0;
    }
    
    setIcon(name) {
        switch(name) {
            case 'ok': {
                this.style.icon.sprite.x = 178;
                this.style.icon.sprite.y = 438;
                break;
            }
            case 'cancel': {
                this.style.icon.sprite.x = 222;
                this.style.icon.sprite.y = 438;
                break;
            }
        }
    }
    
}

// кнопки эффектов
class EffectButton extends Window {
    
    constructor(x, y, size, id, icon, ct) {
        
        super(x, y, size, size, id, null, null);
        this.icon = 'speed';
        this.ct = ct;
        this.style.background.image = './media/gui/bn.png';
        this.style.border.hidden = true;
        this.style.background.sprite = {
            'mode': 'stretch',
            'width': 43,
            'height': 43,
            'x': 0,
            'y': 438
        };
        this.setBackground(this.style.background.image, 'sprite');
        this.style.icon.image = './media/gui/inventory2.png';
        this.style.icon.sprite = {
            'mode': 'stretch',
            'width': 36,
            'height': 36,
            'x': 1,
            'y': 396
        };
        this.setIconImage(this.style.icon.image, 'sprite');

        this.setIcon(icon);
        this.setEnable(true);
        this.setDown(false);
        
        this.onMouseEnter = function() {
            if (this.enable && !this.down) {
                this.style.background.sprite.x = 132;
            }
        };
        
        this.onMouseLeave = function() {
            if (this.enable && !this.down) {
                this.style.background.sprite.x = 0;
            }
        };
        
        this.onMouseDown = function() {
            if (this.enable && !this.down) {
                if (this != this.ct.btn_regeneration && this != this.ct.btn_double) {
                    this.ct.btn_speed.setDown(false);
                    this.ct.btn_haste.setDown(false);
                    this.ct.btn_resistance.setDown(false);
                    this.ct.btn_jump.setDown(false);
                    this.ct.btn_strength.setDown(false);
                    this.setDown(true);
                    this.ct.btn_double.setIcon(this.getIcon());
                }
                if (this == this.ct.btn_regeneration) {
                    this.ct.btn_double.setDown(false);
                    this.setDown(true);
                }
                if (this == this.ct.btn_double) {
                    this.ct.btn_regeneration.setDown(false);
                    this.setDown(true);
                }
            }
        };
    }
    
    setEnable(val) {
        this.enable = val;
        if (!this.enable) {
            this.style.background.sprite.x = 88;
        }
    }
    
    setDown(val) {
        this.down = val;
        this.style.background.sprite.x = this.down ? 43 : 0;
    }
    
    setIcon(name) {
        this.icon = name;
        switch(name) {
            case 'speed': {
                this.style.icon.sprite.x = 1;
                this.style.icon.sprite.y = 396;
                break;
            }
            case 'haste': {
                this.style.icon.sprite.x = 74;
                this.style.icon.sprite.y = 396;
                break;
            }
            case 'resistance': {
                this.style.icon.sprite.x = 216;
                this.style.icon.sprite.y = 431;
                break;
            }
            case 'jump': {
                this.style.icon.sprite.x = 74;
                this.style.icon.sprite.y = 431;
                break;
            }
            case 'strength': {
                this.style.icon.sprite.x = 145;
                this.style.icon.sprite.y = 396;
                break;
            }
            case 'regeneration': {
                this.style.icon.sprite.x = 252;
                this.style.icon.sprite.y = 397;
                break;
            }
        }
    }
    
    getIcon() {
        return this.icon;
    }
    
}

//
export class BeaconWindow extends BaseCraftWindow {

    constructor(player) {
        
        super(10, 10, 459, 438, 'frmBeacon', null, null, player.inventory);
        
        this.w *= this.zoom;
        this.h *= this.zoom;
        this.player = player;
        
        this.style.background.image_size_mode = 'stretch';
        const options = {
            background: {
                image: './media/gui/bn.png',
                image_size_mode: 'sprite',
                sprite: {
                    mode: 'stretch',
                    x: 0,
                    y: 0,
                    width: 459,
                    height: 438
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

        // Создание кнопок для эффектов
        this.createButtons(this.cell_size);
        
         // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size, 70, 272);
        
        // Обработчик закрытия формы
        this.onHide = function() {
            this.inventory.clearDragItem();
            // Save inventory
            Qubatch.world.server.InventoryNewState(this.inventory.exportItems(), []);
        }
        
        // Обработчик открытия формы
        this.onShow = function(args) {
            Qubatch.releaseMousePointer();
        }
        
        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const ct = this;
            // Close button
            const btnClose = new Button(ct.width - 34 * this.zoom, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
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
    
    createButtons(cell_size) {
        this.btn_speed = new EffectButton(105 * this.zoom, 50 * this.zoom, cell_size, 'btnSpeed', 'speed', this);
        this.btn_haste = new EffectButton(145 * this.zoom, 50 * this.zoom, cell_size, 'btnHaste', 'haste', this);
        this.btn_resistance = new EffectButton(105 * this.zoom, 100 * this.zoom, cell_size, 'btnResistance', 'resistance', this);
        this.btn_jump = new EffectButton(145 * this.zoom, 100 * this.zoom, cell_size, 'btnJump', 'jump', this);
        this.btn_strength = new EffectButton(125 * this.zoom, 150 * this.zoom, cell_size, 'btnStrength', 'strength', this);
        this.btn_regeneration = new EffectButton(290 * this.zoom, 100 * this.zoom, cell_size, 'btnRegeneration', 'regeneration', this);
        this.btn_double = new EffectButton(340 * this.zoom, 100 * this.zoom, cell_size, 'btnDouble', 'speed', this);
        
        this.btn_ok = new ActiveButton(310 * this.zoom, 217 * this.zoom, cell_size, 'btnOk', 'ok', this);
        this.btn_cancel = new ActiveButton(350 * this.zoom, 217 * this.zoom, cell_size, 'btnCancel', 'cancel', this);
        
        //this.beacon_slot = new BeaconSlot(270 * this.zoom, 217 * this.zoom, cell_size, cell_size, 'lblBeaconSlot', null, null, this);
        
        this.add(this.btn_speed);
        this.add(this.btn_haste);
        this.add(this.btn_resistance);
        this.add(this.btn_jump);
        this.add(this.btn_strength);
        this.add(this.btn_regeneration);
        this.add(this.btn_double);
        this.add(this.btn_ok);
        this.add(this.btn_cancel);
        //this.add(this.beacon_slot);
    }
    
}

