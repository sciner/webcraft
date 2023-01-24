import { BLOCK } from "../blocks.js";
import { Button, Window } from "../../tools/gui/wm.js";
import { INVENTORY_SLOT_SIZE } from "../constant.js";
import { CraftTableSlot, BaseCraftWindow } from "./base_craft_window.js";
import { Resources } from "../resources.js";

// слот для залога
class BeaconSlot extends CraftTableSlot {

    constructor(x, y, w, h, id, title, text, ct) {
        super(x, y, w, h, id, title, text, ct, null);
        this.ct = ct
    }
        
    onMouseEnter() {
        this.style.background.color = '#ffffff55';
    }

    onMouseLeave() {
        this.style.background.color = '#00000000';
    }
    
    onMouseDown(e) { 
        const dragItem = this.getItem();
        if (!dragItem) {
            return;
        }
        this.getInventory().setDragItem(this, dragItem, e.drag, this.w, this.h)
        this.setItem(null)
    }
    
    onDrop(e) {
        const dropItem = e.drag.getItem().item
        // в слот можно вставлять только алмаз, изумруд, золото, железо, незерит
        if (!dropItem || dropItem.count != 1 || ![BLOCK.GOLD_INGOT.id, BLOCK.DIAMOND.id, BLOCK.IRON_INGOT.id, BLOCK.NETHER_BRICK.id].includes(dropItem.id)) {
            return;
        }
        const dragItem = this.getItem();
        this.setItem(dropItem, e);
        this.getInventory().setDragItem(this, dragItem, e.drag, this.w, this.h)
    }
    
    getInventory() {
        return this.ct.inventory;
    }
    
}

// кнопки активации
class ActiveButton extends Window {
    
    constructor(x, y, size, id, icon, ct) {
        
        super(x, y, size, size, id, null, null)
        
        this.ct = ct

        // this.setIconName(icon)
        // this.setEnable(true)
        // this.setDown(false)

    }
        
    onMouseEnter() {
        if(this.enable && !this.down) {
            // this.style.background.sprite.x = 132
            this.setBackground(this.ct.atlas.getSpriteFromMap('button_black_pressed'))
        }
    };
    
    onMouseLeave() {
        if(this.enable && !this.down) {
            // this.style.background.sprite.x = 0
            this.setBackground(this.ct.atlas.getSpriteFromMap('button'))
        }
    };
    
    onMouseDown() {
        if(this.enable && !this.down) {
            this.ct.btn_ok.setDown(false)
            this.ct.btn_cancel.setDown(false)
            this.setDown(true)
        }
    };
    
    setEnable(val) {
        this.enable = val;
        if (!this.enable) {
            // this.style.background.sprite.x = 88
            this.setBackground(this.ct.atlas.getSpriteFromMap('button_black'))
        }
    }
    
    setDown(val) {
        this.down = val;
        // this.style.background.sprite.x = this.down ? 43 : 0;
        this.setBackground(this.ct.atlas.getSpriteFromMap(this.down ? 'button_pressed' : 'button'))
    }
    
    setIcon(name) {
        switch(name) {
            case 'ok': {
                // this.style.icon.sprite.x = 178;
                // this.style.icon.sprite.y = 438;
                this.setIcon(this.ct.atlas.getSpriteFromMap('ok'))
                break;
            }
            case 'cancel': {
                // this.style.icon.sprite.x = 222;
                // this.style.icon.sprite.y = 438;
                this.setIcon(this.ct.atlas.getSpriteFromMap('cancel'))
                break;
            }
        }
    }
    
}

// кнопки эффектов
class EffectButton extends Window {
    
    constructor(x, y, size, id, icon, ct) {
        
        super(x, y, size, size, id, null, null);

        this.ct = ct
        this.style.border.hidden = true

        this.setBackground(ct.atlas.getSpriteFromMap('button'))
        this.setIcon(ct.atlas.getSpriteFromMap(icon), 'centerstretch', .5)

        this.setEnable(true)
        this.setDown(false)

    }
        
    onMouseEnter() {
        if (this.enable && !this.down) {
            this.setBackground(this.ct.atlas.getSpriteFromMap('button_black_pressed'))
        }
    }

    onMouseLeave() {
        if (this.enable && !this.down) {
            this.setBackground(this.ct.atlas.getSpriteFromMap('button'))
        }
    }

    onMouseDown() {
        const ct = this.ct
        if(this.enable && !this.down) {
            if (this != ct.btn_regeneration && this != ct.btn_double) {
                ct.btn_speed.setDown(false)
                ct.btn_haste.setDown(false)
                ct.btn_resistance.setDown(false)
                ct.btn_jump.setDown(false)
                ct.btn_strength.setDown(false)
                this.setDown(true)
                ct.btn_double.setIconName(this.getIconName())
            }
            if (this == ct.btn_regeneration) {
                ct.btn_double.setDown(false)
                this.setDown(true);
            }
            if (this == ct.btn_double) {
                ct.btn_regeneration.setDown(false)
                this.setDown(true)
            }
        }
    }

    setEnable(val) {
        this.enable = val;
        if (!this.enable) {
            // this.style.background.sprite.x = 88;
            this.setBackground(this.ct.atlas.getSpriteFromMap('button_black'))
        }
    }
    
    setDown(val) {
        this.down = val;
        // this.style.background.sprite.x = this.down ? 43 : 0;
        this.setBackground(this.ct.atlas.getSpriteFromMap(this.down ? 'button_pressed' : 'button'))
    }
    
    setIconName(name) {
        this.icon_name = name
        this.setIcon(this.ct.atlas.getSpriteFromMap(name))
    }
    
    getIconName() {
        return this.icon_name
    }
    
}

//
export class BeaconWindow extends BaseCraftWindow {

    constructor(player) {
        
        super(10, 10, 459, 438, 'frmBeacon', null, null, player.inventory);
        
        this.w *= this.zoom
        this.h *= this.zoom
        this.player = player

        this.atlas = Resources.atlas.bn

        this.setBackground(this.atlas.getSpriteFromMap('background'))

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom

        // Создание кнопок для эффектов
        this.createButtons(this.cell_size)

        // Создание слотов для инвентаря
        this.createInventorySlots(this.cell_size, 70, 272)

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Close button
            const btnClose = new Button(this.w - 34 * this.zoom, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '')
            btnClose.style.font.family = 'Arial'
            btnClose.setBackground(image)
            btnClose.onMouseDown = this.hide.bind(this)
            this.add(btnClose)
        })

    }
        
    // Обработчик закрытия формы
    onHide() {
        this.inventory.clearDragItem()
        // Save inventory
        Qubatch.world.server.InventoryNewState(this.inventory.exportItems(), [])
    }
    
    // Обработчик открытия формы
    onShow(args) {
        Qubatch.releaseMousePointer()
    }
    
    createButtons(cell_size) {

        this.add(this.btn_speed = new EffectButton(105 * this.zoom, 50 * this.zoom, cell_size, 'btnSpeed', 'speed', this))
        this.add(this.btn_haste = new EffectButton(145 * this.zoom, 50 * this.zoom, cell_size, 'btnHaste', 'haste', this))
        this.add(this.btn_resistance = new EffectButton(105 * this.zoom, 100 * this.zoom, cell_size, 'btnResistance', 'resistance', this))
        this.add(this.btn_jump = new EffectButton(145 * this.zoom, 100 * this.zoom, cell_size, 'btnJump', 'jump_boost', this))
        this.add(this.btn_strength = new EffectButton(125 * this.zoom, 150 * this.zoom, cell_size, 'btnStrength', 'strength', this))
        this.add(this.btn_regeneration = new EffectButton(290 * this.zoom, 100 * this.zoom, cell_size, 'btnRegeneration', 'regeneration', this))
        this.add(this.btn_double = new EffectButton(340 * this.zoom, 100 * this.zoom, cell_size, 'btnDouble', 'speed', this))

        this.add(this.btn_ok = new ActiveButton(310 * this.zoom, 217 * this.zoom, cell_size, 'btnOk', 'ok', this))
        this.add(this.btn_cancel = new ActiveButton(350 * this.zoom, 217 * this.zoom, cell_size, 'btnCancel', 'cancel', this))

        // this.beacon_slot = new BeaconSlot(270 * this.zoom, 217 * this.zoom, cell_size, cell_size, 'lblBeaconSlot', null, null, this);

    }
    
}

