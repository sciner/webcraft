import { BLOCK } from "../blocks.js"
import { Button, Window } from "../../tools/gui/wm.js"
import { INVENTORY_SLOT_SIZE, SKIN_RIGHTS_DEFAULT } from "../constant.js"
import { CraftTableSlot, BaseCraftWindow } from "./base_craft_window.js"
import { Resources } from "../resources.js"
import { BaseChestWindow } from "./base_chest_window.js"
import { Vector } from "../helpers.js"

// кнопки активации
class OkButton extends Window {
    
    constructor(x, y, size, id, icon, ct) {
        
        super(x, y, size, size, id, null, null)

        this.ct = ct
        this.style.border.hidden = true

        this.setBackground(ct.atlas.getSpriteFromMap('button'))
        this.setIcon(ct.atlas.getSpriteFromMap('ok'), 'centerstretch', .5)
    }
        
    onMouseEnter() {
        this.setBackground(this.ct.atlas.getSpriteFromMap('button_black_pressed'))
    }
    
    onMouseLeave() {
        this.setBackground(this.ct.atlas.getSpriteFromMap('button'))
    }
}

// кнопки эффектов
class EffectButton extends Window {
    
    constructor(x, y, size, id, icon, ct) {
        
        super(x, y, size, size, id, null, null)

        this.ct = ct
        this.style.border.hidden = true

        this.setBackground(ct.atlas.getSpriteFromMap('button'))
        this.setIcon(ct.atlas.getSpriteFromMap(icon), 'centerstretch', .5)

        this.setIconName(icon)
        this.setEnable(true)
        this.setDown(false)

    }
        
    onMouseEnter() {
        const ct = this.ct
        ct.updateButtons()
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
                if (this == ct.btn_speed) {
                    ct.state.first = 1
                }
                if (this == ct.btn_haste) {
                    ct.state.first = 2
                }
                if (this == ct.btn_resistance) {
                    ct.state.first = 3
                }
                if (this == ct.btn_jump) {
                    ct.state.first = 4
                }
                if (this == ct.btn_strength) {
                    ct.state.first = 5
                }
                ct.btn_double.setIconName(this.getIconName())
            }
            if (this == ct.btn_regeneration) {
                ct.state.second = 1
            }
            if (this == ct.btn_double) {
                ct.state.second = 2
            }
        }
        ct.updateButtons()
    }

    setEnable(val) {
        this.enable = val
        if (!this.enable) {
            this.setBackground(this.ct.atlas.getSpriteFromMap('button_black'))
        }
    }
    
    setDown(val) {
        if (!this.enable) {
            return
        }
        this.down = val
        this.setBackground(this.ct.atlas.getSpriteFromMap(this.down ? 'button_pressed' : 'button'))
    }
    
    setIconName(name) {
        this.icon_name = name
        this.setIcon(this.ct.atlas.getSpriteFromMap(name), 'centerstretch', .5)
    }
    
    getIconName() {
        return this.icon_name
    }
    
}

//
export class BeaconWindow extends BaseChestWindow {

    constructor(inventory) {
        
        super(10, 10, 459, 438, 'frmBeacon', null, null, inventory, {
            title: 'Beacon',
            sound: {
                open: null, // {tag: BLOCK.CHARGING_STATION.sound, action: 'open'},
                close: null // {tag: BLOCK.CHARGING_STATION.sound, action: 'close'}
            }
        })

        this.atlas = Resources.atlas.bn

        this.setBackground(this.atlas.getSpriteFromMap('background'))

        // Ширина / высота слота
        this.cell_size = INVENTORY_SLOT_SIZE * this.zoom

        // Создание кнопок для эффектов
        this.createButtons(this.cell_size)

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

    //
    prepareSlots() {
        const resp = []
        resp.push({pos: new Vector(32 * this.zoom, 32 * this.zoom, 0)})
        return resp
    }

    // Обработчик открытия формы
    onShow() {
        super.onShow()
        this.updateButtons()
    }

    createButtons(cell_size) {
        const self = this
        this.add(this.btn_speed = new EffectButton(105 * this.zoom, 50 * this.zoom, cell_size, 'btnSpeed', 'speed', this))
        this.add(this.btn_haste = new EffectButton(145 * this.zoom, 50 * this.zoom, cell_size, 'btnHaste', 'haste', this))
        this.add(this.btn_resistance = new EffectButton(105 * this.zoom, 100 * this.zoom, cell_size, 'btnResistance', 'resistance', this))
        this.add(this.btn_jump = new EffectButton(145 * this.zoom, 100 * this.zoom, cell_size, 'btnJump', 'jump_boost', this))
        this.add(this.btn_strength = new EffectButton(125 * this.zoom, 150 * this.zoom, cell_size, 'btnStrength', 'strength', this))
        this.add(this.btn_regeneration = new EffectButton(290 * this.zoom, 100 * this.zoom, cell_size, 'btnRegeneration', 'regeneration', this))
        this.add(this.btn_double = new EffectButton(340 * this.zoom, 100 * this.zoom, cell_size, 'btnDouble', 'speed', this))
        this.add(this.btn_ok = new OkButton(310 * this.zoom, 217 * this.zoom, cell_size, 'btnOk', 'ok', this))
        this.btn_ok.onMouseDown = function(e) {
            const pos = self.info.pos
            const block = Qubatch.world.getBlock(pos)
            const extra_data = block.extra_data
            extra_data.state.first = self.state.first
            extra_data.state.second = self.state.second
            Qubatch.world.changeBlockExtraData(pos, extra_data)
            self.hide()
        }
    }


    updateButtons() {
        this.btn_speed.setEnable(this?.state?.level > 0 ? true : false)
        this.btn_haste.setEnable(this?.state?.level > 0 ? true : false)
        this.btn_resistance.setEnable(this?.state?.level > 1 ? true : false)
        this.btn_jump.setEnable(this?.state?.level > 1 ? true : false)
        this.btn_strength.setEnable(this?.state?.level > 2 ? true : false)
        this.btn_double.setEnable(this?.state?.level > 3 ? true : false)
        this.btn_regeneration.setEnable(this?.state?.level > 3 ? true : false)
        this.btn_speed.setDown(this?.state?.first == 1 ? true : false)
        this.btn_haste.setDown(this?.state?.first == 2 ? true : false)
        this.btn_resistance.setDown(this?.state?.first == 3 ? true : false)
        this.btn_jump.setDown(this?.state?.first == 4 ? true : false)
        this.btn_strength.setDown(this?.state?.first == 5 ? true : false)
        this.btn_regeneration.setDown(this?.state?.second == 1 ? true : false)
        this.btn_double.setDown(this?.state?.second == 2 ? true : false)
    }
    
}

