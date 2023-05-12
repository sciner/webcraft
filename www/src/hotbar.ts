// import { SpriteAtlas } from "./core/sprite_atlas.js";
import { Resources } from "./resources.js";
// import { PlayerInventory } from "./player_inventory.js";

import { Effect } from "./block_type/effect.js";
import { CraftTableInventorySlot } from "./window/base_craft_window.js";
import { BAG_LINE_COUNT, HOTBAR_LENGTH_MAX, PAPERDOLL_BOOTS, PAPERDOLL_CHESTPLATE, PAPERDOLL_HELMET, PAPERDOLL_LEGGINGS } from "./constant.js";
import type { SpriteAtlas } from "./core/sprite_atlas.js";
import type { HUD } from "./hud.js";
import type { PlayerInventory } from "./player_inventory.js";
import { Label, MySprite, MyTilemap, Window } from "./ui/wm.js";

const MAX_NAME_SHOW_TIME    = 2000;
const SLOT_MARGIN_PERCENT   = 1
const MARGIN                = 6

//
const LIVE_SHIFT_RANDOM = new Array(1024);
for(let i = 0; i < LIVE_SHIFT_RANDOM.length; i++) {
    LIVE_SHIFT_RANDOM[i] = Math.round(Math.random());
}

//
class Strings {

    strings : {set_time: any, text : any, measure : any, max_time : any}[]

    constructor() {
        this.strings = [
            {text: null, set_time: null, measure: null, max_time: null},
            {text: null, set_time: null, measure: null, max_time: null}
        ];
    }

    // set new text
    setText(index, text, max_time) {
        this.strings[index].text = text;
        if(text) {
            this.strings[index].set_time = performance.now();
            this.strings[index].measure = null;
            this.strings[index].max_time = max_time;
        }
    }

    // set text if not same with previous
    updateText(index, text, max_time) {
        if(this.strings[index].text == text) {
            return false;
        }
        this.setText(index, text, max_time);
    }

    // draw
    draw(window : Window, window_shadow : Window) {

        const texts = []

        // draw strings on center of display
        for(let i = 0; i < this.strings.length; i++) {
            const item = this.strings[i];
            if(!item.text) {
                continue;
            }
            const time_remains = performance.now() - item.set_time;
            const max_time = item.max_time || MAX_NAME_SHOW_TIME;
            if(time_remains > max_time) {
                continue;
            }
            // Text opacity
            const alpha = Math.min(2 - (time_remains / max_time) * 2, 1);
            let aa = Math.ceil(255 * alpha).toString(16);
            if(aa.length == 1) {
                aa = '0' + aa;
            }
            texts.push(item.text)
        }

        const _text = texts.join('\n')

        if(window.text != _text) {
            window.text = _text
            window_shadow.text = window.text
        }

    }

}

export class Hotbar {
    [key: string]: any

    sprites:                    Dict<MySprite> = {}
    inventory:                  PlayerInventory
    hotbar_atlas:               SpriteAtlas
    hud_atlas:                  SpriteAtlas
    hud_sprites:                Dict<MySprite> = {}
    inventory_slots_window:     Window
    sx:                         float
    sy:                         float
    sprite_zoom:                float
    bars:                       Dict<Label> = {}
    strings:                    Strings

    constructor(hud : HUD) {

        this.hud                = hud
        this.last_damage_time   = null
        this.strings            = new Strings()
        this.sprite_zoom        = .3 * this.zoom

        // Load hotbar atlases
        const all = []

        this.icons_atlas = Resources.atlas.get('icons')

        Promise.all(all).then(_ => {

            this.tilemap = new MyTilemap()
            hud.wm.addChild(this.tilemap)

            this.addHotbarText()

            // Init sprites
            const spriteScale: Dict<number> = {

                slot:               1,
                selector:           1,

                live:               0.9,
                live_half:          0.9,
                live_bg_black:      0.9,
                live_bg_white:      0.9,
                live_poison:        0.9,
                live_poison_half:   0.9,

                food_bg_black:      0.9,
                food:               0.9,
                food_half:          0.9,
                food_poison:        0.9,
                food_poison_half:   0.9,

                oxygen:             0.9,
                oxygen_half:        0.9,

                armor_bg_black:     0.9,
                armor:              0.9,
                armor_half:         0.9
            }

            this.hotbar_atlas = Resources.atlas.get('hotbar')
            
            // HUD sprites
            this.hud_atlas = Resources.atlas.get('hud')
            for(let name of Object.keys(this.hud_atlas.sheet.data.frames)) {
                this.hud_sprites[name] = new MySprite(this.hud_atlas.getSpriteFromMap(name), this.sprite_zoom)
            }
            this.sx = this.hud_sprites.slot_empty.width
            this.sy = this.hud_sprites.slot_empty.height

            // Hotbar
            for(const [name, scale] of Object.entries(spriteScale)) {
                this.sprites[name] = new MySprite(this.hotbar_atlas.getSpriteFromMap(name), scale * this.zoom)
            }

            const bn_atlas = Resources.atlas.get('bn')

            // Effects sprites
            this.effect_sprites = {}
            for(let effect of Effect.get()) {
                this.effect_sprites[effect.id] = new MySprite(bn_atlas.getSpriteFromMap(effect.icon), 1 * this.zoom)
            }

            this.sprite_effect_bg = new MySprite(bn_atlas.getSpriteFromMap('button_black'), 1 * this.zoom)

            this.hud.add(this, 0)

        })

    }

    addHotbarText() {

        const hud = this.hud

        // Hotbar text in center of screen
        hud.wm._wmoverlay.add(this.lblHotbarTextShadow = new Window(0, 0, 0, 0, 'lblHotbarText', undefined, 'Lang.loading'))
        this.lblHotbarTextShadow.catchEvents = false
        this.lblHotbarTextShadow.style.textAlign.horizontal = 'center'
        this.lblHotbarTextShadow.style.textAlign.vertical = 'bottom'
        this.lblHotbarTextShadow.style.font.color = '#00000055'
        this.lblHotbarTextShadow.style.font.size = 18

        // Hotbar text in center of screen
        hud.wm._wmoverlay.add(this.lblHotbarText = new Window(0, 0, 0, 0, 'lblHotbarText', undefined, 'Lang.loading'))
        this.lblHotbarText.catchEvents = false
        this.lblHotbarText.style.textAlign.horizontal = 'center'
        this.lblHotbarText.style.textAlign.vertical = 'bottom'
        this.lblHotbarText.style.font.color = '#ffffff'
        this.lblHotbarText.style.font.size = 18

        // const fs = this.lblHotbarText.text_container.style
        // fs.stroke = '#00000099'
        // fs.strokeThickness = 4
        // fs.lineHeight = UI_ZOOM * 20
        //
        // fs.dropShadow = true
        // fs.dropShadowAlpha = 1
        // fs.dropShadowBlur = 4
        // fs.dropShadowAngle = 0 // Math.PI / 6
        // fs.dropShadowColor = 0x0
        // fs.dropShadowDistance = 0
    }

    /**
    * Создание слотов для инвентаря
    * @param sz Ширина / высота слота
    */
    createInventorySlots() {

        const sz = this.sx

        // bars
        this.bars = {}
        const bars_base_sprite = this.hud_atlas.getSpriteFromMap('bars_base') // this.hud_sprites.bars_base
        const sprite_zoom = this.sprite_zoom
        const bars_base_window = this.bars_base_window = new Window(MARGIN * this.zoom, 0, bars_base_sprite.width * sprite_zoom, bars_base_sprite.height * sprite_zoom, 'bars_base')
        bars_base_window.catchEvents = false
        bars_base_window.auto_center = false
        bars_base_window.setBackground(this.hud_atlas.getSpriteFromMap('bars_base'))
        let y = 6 * this.zoom
        for(let item of [{id: 'hp', sprite: 'hpbar_back', sprite_value: 'hpbar'}, {id: 'hunger', sprite: 'hungerbar_back', sprite_value: 'hungerbar'}]) {
            const sprite = this.hud_atlas.getSpriteFromMap(item.sprite)
            const x = 28 * this.zoom
            const w = sprite.width * sprite_zoom
            const h = sprite.height * sprite_zoom
            //
            const bar = new Label(x, y, w, h, item.id)
            bar.setBackground(sprite)
            //
            const bar_value = new Label(0, 0, w, h, item.id)
            bar_value.setBackground(this.hud_atlas.getSpriteFromMap(item.sprite_value))
            bar.add(bar_value)
            //
            bars_base_window.add(bar)
            this.bars[item.id] = bar_value
            y += h + 12 * sprite_zoom
        }
        this.hud.wm.addChild(bars_base_window)

        // Oxygen indicator
        const oxygen_bar = this.oxygen_bar = new Label(0, 0, 432/3 * this.zoom, 44/3*this.zoom, 'oxygen_bar')
        const oxygen_bar_value = new Label(0, 0, oxygen_bar.w, oxygen_bar.h, 'oxygen_bar_value')
        oxygen_bar.auto_center = false
        oxygen_bar.setBackground(this.hud_atlas.getSpriteFromMap('o2bar_back'))
        oxygen_bar_value.setBackground(this.hud_atlas.getSpriteFromMap('o2bar'))
        oxygen_bar.add(oxygen_bar_value)
        oxygen_bar.value_bar = oxygen_bar_value
        this.hud.wm.addChild(oxygen_bar)

        const armor_base_sprite = this.hud_atlas.getSpriteFromMap('armor_0') 
        const armor_base_window = this.armor_base_window = new Window(MARGIN * this.zoom, 0, armor_base_sprite.width * sprite_zoom, armor_base_sprite.height * sprite_zoom, 'armor_base')
        armor_base_window.catchEvents = false
        armor_base_window.auto_center = false
        armor_base_window.setBackground(armor_base_sprite)
        this.armors = {}
        this.armors[PAPERDOLL_HELMET]     = new Label(8.5 * this.zoom, 0, 47 * sprite_zoom, 38 * sprite_zoom, 'armor_helmet')
        this.armors[PAPERDOLL_CHESTPLATE] = new Label(0, 12 * this.zoom, 104 * sprite_zoom, 71 * sprite_zoom, 'armor_chestplate')
        this.armors[PAPERDOLL_LEGGINGS]   = new Label(7.5 * this.zoom, 33 * this.zoom, 53 * sprite_zoom, 62 * sprite_zoom, 'armor_leggins')
        this.armors[PAPERDOLL_BOOTS]   = new Label(7.5 * this.zoom, 52 * this.zoom, 53 * sprite_zoom, 26 * sprite_zoom, 'armor_boots')
        for(let k in this.armors) {
            armor_base_window.add(this.armors[k])
        }
        this.hud.wm.addChild(armor_base_window)

        const inventory_slots_window = this.inventory_slots_window = new Window(bars_base_window.x + bars_base_window.w + MARGIN * this.zoom, 0, BAG_LINE_COUNT * (sz * SLOT_MARGIN_PERCENT) - (sz * SLOT_MARGIN_PERCENT - sz), sz, 'hotbar_inventory_slots')
        inventory_slots_window.auto_center = false
        inventory_slots_window.catchEvents = false
        inventory_slots_window.slots = []

        for(let i = 0; i < HOTBAR_LENGTH_MAX; i++) {
            const lblSlot = new CraftTableInventorySlot(i * (sz * SLOT_MARGIN_PERCENT), 0, sz, sz, `lblSlot${i}`, null, null, this, i)
            lblSlot.slot_empty  = 'slot_empty'
            lblSlot.slot_full   = 'slot_full'
            lblSlot.slot_locked = 'none'
            lblSlot.style.background.color = '#00000000'
            lblSlot.style.border.hidden = true
            inventory_slots_window.add(lblSlot)
            inventory_slots_window.slots.push(lblSlot)
        }
        this.hud.wm.addChild(inventory_slots_window)

    }

    get zoom() : float {
        return UI_ZOOM * Qubatch.settings.window_size / 100
    }

    setInventory(inventory : PlayerInventory) {
        this.inventory = inventory
        this.createInventorySlots()
    }

    //
    damage(damage_value : float, reason_text : string) {
        this.last_damage_time = performance.now();
        console.error('error_not_implemented', damage_value, reason_text);
        this.inventory.player.world.server.ModifyIndicator('live', -damage_value, reason_text);
    }

    setState(new_state) {
        for(const [key, value] of Object.entries(new_state)) {
            this[key] = value;
        }
    }

    // выводит полосу
    drawStrip(x, y, val, full, half, bbg = null, wbg = null, blink = false, wave = false, reverse = false) {
        const size = full.width
        val /= 2
        const spn = Math.round(performance.now() / 75)
        if (bbg) {
            const bg = blink ? wbg : bbg
            for (let i = 0; i < 10; i++) {
                const sy = wave ? LIVE_SHIFT_RANDOM[(spn + i) % LIVE_SHIFT_RANDOM.length] * 5 : 0
                bg.x = x + ((reverse) ? i * size : (size * 9 - i * size))
                bg.y = y + sy
                this.tilemap.drawImage(bg)
            }
        }
        for (let i = 0; i < 10; i++) {
            const sy = wave ? LIVE_SHIFT_RANDOM[(spn + i) % LIVE_SHIFT_RANDOM.length] * 5 : 0
            const d = val - 0.5
            if ( d > i) {
                full.x = x + ((!reverse) ? i * size : (size * 9 - i * size))
                full.y = y + sy
                this.tilemap.drawImage(full)
            } else if (d == i) {
                half.x = x + ((!reverse) ? i * size : (size * 9 - i * size))
                half.y = y + sy
                this.tilemap.drawImage(half)
            }
        }
    }

    drawHUD(hud : HUD) {

        this.tilemap.clear()

        const player  = this.inventory.player;
        const mayGetDamaged = player.game_mode.mayGetDamaged()
        const visible = !player.game_mode.isSpectator() && hud.isActive()

        this.inventory_slots_window.visible = visible
        this.bars_base_window.visible = visible && mayGetDamaged
        this.armor_base_window.visible = visible && mayGetDamaged
        this.oxygen_bar.visible = visible && mayGetDamaged

        if(!visible) {
            return false;
        }

        // Inventory slots
        // this.inventory_slots_window.transform.position.set(hud.width / 2 - this.inventory_slots_window.w / 2, hud.height - this.inventory_slots_window.h - MARGIN * this.zoom)
        this.inventory_slots_window.transform.position.set(
            mayGetDamaged ? this.bars_base_window.x + this.bars_base_window.w + MARGIN * this.zoom : MARGIN * this.zoom,
            hud.height - this.inventory_slots_window.h - MARGIN * this.zoom
        )
        if(this.inventory_update_number != this.inventory.update_number) {
            this.inventory_update_number = this.inventory.update_number
            for(let i = 0; i < this.inventory_slots_window.slots.length; i++) {
                const w = this.inventory_slots_window.slots[i]
                w.setItem(w.getItem(), false)
            }
        }

        let hotbar_height = 0

        if (mayGetDamaged) {
            // const left = 180 * this.zoom
            // const right = 15 * this.zoom
            // const bottom_one_line = 70 * this.zoom
            const bottom_two_line = 90 * this.zoom
            hotbar_height = bottom_two_line
            // const diff = Math.round(performance.now() - Qubatch.hotbar.last_damage_time);
            // моргание от урона
            // const is_damage = (diff > 0 && diff < 100 || diff > 200 && diff < 300)
            // const low_live = live < 3

            this.bars_base_window.transform.position.y = this.inventory_slots_window.transform.position.y + this.bars_base_window.h * .03

            this.armor_base_window.transform.position.y = this.inventory_slots_window.transform.position.y - 70 *this.zoom

            // здоровье
            const live = player.indicators.live
            if(this.bars.hp.prev_value !== live) {
                this.bars.hp.prev_value = live
                this.bars.hp.clip(0, 0, this.bars.hp.w * (live / 20.))
            }

            // еда
            const food = player.indicators.food
            if(this.bars.hunger.prev_value !== food) {
                this.bars.hunger.prev_value = food
                this.bars.hunger.clip(0, 0, this.bars.hunger.w * (food / 20.))
            }

            // const x = MARGIN * this.zoom
            // const y = this.inventory_slots_window.y
            // this.tilemap.drawImage(this.hud_sprites.bars_base, x, y)
            // this.bars.hp_bar
            // this.bars.hunger_bar

            // this.tilemap.drawImage(this.hud_sprites.hpbar_back, x + 28 * this.zoom, y + 6 * this.zoom)
            // this.tilemap.drawImage(this.hud_sprites.hungerbar_back, x + 28 * this.zoom, y + (6 + 16) * this.zoom)

            // if (player.getEffectLevel(Effect.POISON) > 0) {
            //     this.drawStrip(hud.width / 2 - left, hud.height - bottom_one_line , live, this.sprites.live_poison, this.sprites.live_poison_half, this.sprites.live_bg_black, this.sprites.live_bg_white, is_damage, low_live)
            // } else {
            //     this.drawStrip(hud.width / 2 - left, hud.height - bottom_one_line , live, this.sprites.live, this.sprites.live_half, this.sprites.live_bg_black, this.sprites.live_bg_white, is_damage, low_live)
            // }
            // // еда
            // const food = player.indicators.food;
            // if (player.getEffectLevel(Effect.HUNGER) > 0) {
            //     this.drawStrip(hud.width / 2 + right, hud.height - bottom_one_line , food, this.sprites.food_poison, this.sprites.food_poison_half, this.sprites.food_bg_black, null, false, false, true);
            // } else {
            //     this.drawStrip(hud.width / 2 + right, hud.height - bottom_one_line , food, this.sprites.food, this.sprites.food_half, this.sprites.food_bg_black, null, false, false, true);
            // }

            // кислород
            const oxygen = player.indicators.oxygen
            const oxygen_max = 20
            this.oxygen_bar.visible = oxygen < oxygen_max
            if (this.oxygen_bar.visible) {
                // this.drawStrip(hud.width / 2 + right,  hud.height - bottom_two_line, oxygen, this.sprites.oxygen, this.sprites.oxygen_half, null, null, false, false, true)
                this.oxygen_bar.x = hud.width/2 - this.oxygen_bar.w/2
                this.oxygen_bar.y = hud.height/2 + this.oxygen_bar.h * 10
                if(this.oxygen_bar.value_bar.prev_value !== oxygen) {
                    this.oxygen_bar.value_bar.prev_value = oxygen
                    this.oxygen_bar.value_bar.clip(0, 0, this.oxygen_bar.value_bar.w * (oxygen / oxygen_max))
                }
            }

            for(const slot_index of [PAPERDOLL_BOOTS, PAPERDOLL_LEGGINGS, PAPERDOLL_CHESTPLATE, PAPERDOLL_HELMET]) {
                const slot = this.armors[slot_index]
                if (slot) {
                    const power = this.inventory.getArmorPower(slot_index)
                    if(slot.prev_power != power) {
                        slot.prev_power = power
                        let bg = null
                        if (power > 70) {
                            bg = slot.id + '_green'
                        } else if (power > 40) {
                            bg = slot.id + '_yellow'
                        } else if (power > 0) {
                            bg = slot.id + '_red'
                        }
                        slot.setBackground(bg)
                    }
                }
            }

        }

        // хотбар и селектор
        const sx = this.sx
        const sy = this.sy
        const size = this.inventory.getSize()
        for (let i = 0; i < HOTBAR_LENGTH_MAX; i++) {
            const x = this.inventory_slots_window.x + i * (sx * SLOT_MARGIN_PERCENT)
            const y = this.inventory_slots_window.y
            // item
            // const item = this.inventory_slots_window.slots[i].getItem()
            // this.tilemap.drawImage(item ? this.hud_sprites.slot_full : this.hud_sprites.slot_empty, x, y)
            // selector
            if (i == this.inventory.getRightIndex()) {
                this.tilemap.drawImage(this.hud_sprites.slot_selection, x, y)
            }
            this.inventory_slots_window.slots[i].locked = !size.slotExists(i)
        }

        if(hotbar_height == 0) {
            hotbar_height = sy
        }

        this.drawEffects(hud)

        // Draw strings
        this.lblHotbarText.w = hud.width
        this.lblHotbarText.h = hud.height
        this.lblHotbarTextShadow.w = hud.width + 3
        this.lblHotbarTextShadow.h = hud.height + 3

        this.lblHotbarText.style.padding.bottom = hotbar_height + 10 * this.zoom
        this.lblHotbarTextShadow.style.padding.bottom = hotbar_height + 10 * this.zoom

        this.strings.draw(this.lblHotbarText, this.lblHotbarTextShadow)

    }


    drawEffects(hud) {
        const margin = 4 * this.zoom
        let pos = margin
        const bg = this.sprite_effect_bg
        for(let effect of this.inventory.player.effects.effects) {
            const sprite = this.effect_sprites[effect.id]
            const paddingx = bg.width / 2 - sprite.width / 2
            const paddingy = bg.height / 2 - sprite.height / 2
            const x = hud.width - pos - bg.width
            const y = margin
            this.tilemap.drawImage(bg, x, y)
            this.tilemap.drawImage(sprite, x + paddingx, y + paddingy)
            pos += margin + bg.width
        }
    }

}