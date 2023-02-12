import { Button, Window, Label} from "../../tools/gui/wm.js"
import { INVENTORY_SLOT_SIZE } from "../constant.js"
import { Resources } from "../resources.js"
import { BaseChestWindow } from "./base_chest_window.js"
import { Vector } from "../helpers.js"
import { Effect } from "../block_type/effect.js"
import { Lang } from "../lang.js";

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
                    ct.tmp_state.first = Effect.SPEED
                }
                if (this == ct.btn_haste) {
                    ct.tmp_state.first = Effect.HASTE
                }
                if (this == ct.btn_resistance) {
                    ct.tmp_state.first = Effect.RESISTANCE
                }
                if (this == ct.btn_jump) {
                    ct.state.first = Effect.JUMP_BOOST
                }
                if (this == ct.btn_strength) {
                    ct.tmp_state.first = Effect.STRENGTH
                }
            }
            if (this == ct.btn_regeneration) {
                ct.tmp_state.second = Effect.REGENERATION
            }
            if (this == ct.btn_double) {
                ct.tmp_state.second = 0
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

export class BeaconWindow extends BaseChestWindow {

    constructor(inventory) {
        super(0, 0, 459, 438, 'frmBeacon', null, null, inventory, {
            title: '',
            sound: {
                open: null, // {tag: BLOCK.CHARGING_STATION.sound, action: 'open'},
                close: null // {tag: BLOCK.CHARGING_STATION.sound, action: 'close'}
            }
        })
        this.bm = inventory.player.world.block_manager
        this.atlas = Resources.atlas.bn
        this.setBackground(this.atlas.getSpriteFromMap('background'))
        // надписи на окне
        this.craeteLabels()
        // Создание кнопок для эффектов
        this.createButtons()
        // Add close button
        this.loadCloseButtonImage((image) => {
            // Close button
            const btnClose = new Button(this.w - 34 * this.zoom, 9 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '')
            btnClose.style.font.family = 'Arial'
            btnClose.setBackground(image)
            btnClose.onMouseDown = this.hide.bind(this)
            this.add(btnClose)
        })

        // fix shift inventory
        this.lbl2.x += 55 * this.zoom
        for(let slot of this.inventory_slots) {
            slot.x += 55 * this.zoom
        }
    }

    onShow() {
        super.onShow()
        this.tmp_state = this.state
        this.updateButtons()
    }
    
    prepareSlots() {
        const resp = []
        resp.push({pos: new Vector(270 * this.zoom, 218 * this.zoom, 0)})
        return resp
    }

    craeteLabels() {
        this.add(this.lblPrimary = new Label(20 * this.zoom, 15 * this.zoom, 207 * this.zoom, 30 * this.zoom, 'lblPrimary', null, Lang.beacon_primary))
        this.add(this.lblSecondary = new Label(235 * this.zoom, 15 * this.zoom, 175 * this.zoom, 30 * this.zoom, 'lblSecondary', null, Lang.beacon_secondary))
        for(let lbl of [this.lblPrimary, this.lblSecondary]) {
            lbl.style.font.color = '#ffffff'
            lbl.style.font.size = 12
            lbl.style.textAlign.horizontal = 'center'
        }
        let lbl = new Label(80 * this.zoom, 213 * this.zoom, 40 * this.zoom, 40 * this.zoom, 'lblEmerald')
        lbl.setBackground(Resources.inventory.atlas.getSpriteFromMap('EMERALD'))
        this.add(lbl)
        lbl = new Label(122 * this.zoom, 213 * this.zoom, 40 * this.zoom, 40 * this.zoom, 'lblDiamond')
        lbl.setBackground(Resources.inventory.atlas.getSpriteFromMap('DIAMOND'))
        this.add(lbl)
        lbl = new Label(164 * this.zoom, 213 * this.zoom, 40 * this.zoom, 40 * this.zoom, 'lblGold')
        lbl.setBackground(Resources.inventory.atlas.getSpriteFromMap('GOLD_INGOT'))
        this.add(lbl)
        lbl = new Label(208 * this.zoom, 213 * this.zoom, 40 * this.zoom, 40 * this.zoom, 'lblIron')
        lbl.setBackground(Resources.inventory.atlas.getSpriteFromMap('IRON_INGOT'))
        this.add(lbl)
    }

    createButtons() {
        const size = INVENTORY_SLOT_SIZE * this.zoom
        const self = this
        this.add(this.btn_speed = new EffectButton(105 * this.zoom, 50 * this.zoom, size, 'btnSpeed', 'speed', this))
        this.add(this.btn_haste = new EffectButton(145 * this.zoom, 50 * this.zoom, size, 'btnHaste', 'haste', this))
        this.add(this.btn_resistance = new EffectButton(105 * this.zoom, 100 * this.zoom, size, 'btnResistance', 'resistance', this))
        this.add(this.btn_jump = new EffectButton(145 * this.zoom, 100 * this.zoom, size, 'btnJump', 'jump_boost', this))
        this.add(this.btn_strength = new EffectButton(125 * this.zoom, 150 * this.zoom, size, 'btnStrength', 'strength', this))
        this.add(this.btn_regeneration = new EffectButton(290 * this.zoom, 100 * this.zoom, size, 'btnRegeneration', 'regeneration', this))
        this.add(this.btn_double = new EffectButton(340 * this.zoom, 100 * this.zoom, size, 'btnDouble', 'speed', this))
        this.add(this.btn_ok = new OkButton(310 * this.zoom, 217 * this.zoom, size, 'btnOk', 'ok', this))
        this.btn_ok.onMouseDown = function(e) {
            const pos = self.info.pos
            const block = Qubatch.world.getBlock(pos)
            const item = block.extra_data.slots[0]
            if (!item || item.count != 1 || ![this.bm.GOLD_INGOT.id, this.bm.IRON_INGOT.id, this.bm.NETHERITE_INGOT.id, this.bm.DIAMOND.id, this.bm.EMERALD.id].includes(item.id)) {
                return
            }
            const extra_data = block.extra_data
            extra_data.state.first = self.tmp_state.first
            extra_data.state.second = self.tmp_state.second
            Qubatch.world.changeBlockExtraData(pos, extra_data)
        }
    }

    updateButtons() {
        this.btn_speed.setEnable(this?.tmp_state?.level > 0 ? true : false)
        this.btn_haste.setEnable(this?.tmp_state?.level > 0 ? true : false)
        this.btn_resistance.setEnable(this?.tmp_state?.level > 1 ? true : false)
        this.btn_jump.setEnable(this?.tmp_state?.level > 1 ? true : false)
        this.btn_strength.setEnable(this?.tmp_state?.level > 2 ? true : false)
        this.btn_double.setEnable(this?.tmp_state?.level > 3 ? true : false)
        this.btn_regeneration.setEnable(this?.tmp_state?.level > 3 ? true : false)
        this.btn_speed.setDown(this?.tmp_state?.first == Effect.SPEED ? true : false)
        this.btn_haste.setDown(this?.tmp_state?.first == Effect.HASTE ? true : false)
        this.btn_resistance.setDown(this?.tmp_state?.first == Effect.RESISTANCE ? true : false)
        this.btn_jump.setDown(this?.tmp_state?.first == Effect.JUMP_BOOST ? true : false)
        this.btn_strength.setDown(this?.tmp_state?.first == Effect.STRENGTH ? true : false)
        this.btn_regeneration.setDown(this?.tmp_state?.second == Effect.REGENERATION ? true : false)
        this.btn_double.setDown(this?.tmp_state?.second == 0 ? true : false)
        this.btn_double.setIconName(Effect.get()[this.tmp_state.first].icon)
    }

}