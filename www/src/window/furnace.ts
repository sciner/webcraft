import { Vector } from "../helpers.js";
import { Lang } from "../lang.js";
import {BaseChestWindow, TChestWindowSlotInfo} from "./base_chest_window.js";
import { Icon, Label } from "../ui/wm.js";
import type { PlayerInventory } from "../player_inventory.js";
import { INGAME_MAIN_WIDTH, INGAME_MAIN_HEIGHT } from "../constant.js";
import type {TCmdChestContent} from "../chest.js";
import {SpriteAtlas} from "../core/sprite_atlas.js";

export class FurnaceWindow extends BaseChestWindow {

    icon_arrow : Label
    icon_fire : Label

    constructor(inventory : PlayerInventory) {

        const w = 600
        const h = 400

        super(0, 0, INGAME_MAIN_WIDTH, INGAME_MAIN_HEIGHT, 'frmFurnace', null, null, inventory, {
            title: Lang.furnace,
            sound: {
                open: null, // {tag: BLOCK.CHARGING_STATION.sound, action: 'open'},
                close: null // {tag: BLOCK.CHARGING_STATION.sound, action: 'close'}
            }
        })

        const z = this.zoom / (w / INGAME_MAIN_WIDTH) / 2

        this.icon_fire = new Label(156 * z, 188 * z, 58 * z, 56 * z, 'iconFire')
        this.add(this.icon_fire)

        this.icon_arrow = new Label(214 * z, 184 * z, 96 * z, 68 * z, 'iconArrow')
        this.add(this.icon_arrow)

        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/form-furnace.png').then(async (atlas : SpriteAtlas) => {
            this.setBackground(await atlas.getSprite(0, 0, w * 2, h * 2), 'none', this.zoom / 2.0)
            this.icon_fire.setBackground(await this.atlas.getSprite(0, 800, 58, 56), 'none', this.zoom / 2.0 )
            this.icon_arrow.setBackground(await this.atlas.getSprite(0, 856, 96, 68), 'none', this.zoom / 2.0 )
        })
        
    }

    //
    prepareSlots(): TChestWindowSlotInfo[] {
        const resp = [];
        resp.push({pos: new Vector(100, 80, 0).multiplyScalarSelf(this.zoom)});
        resp.push({pos: new Vector(100, 160, 0).multiplyScalarSelf(this.zoom)});
        resp.push({pos: new Vector(200, 120, 0).multiplyScalarSelf(this.zoom), readonly: true});
        return resp;
    }

    // Пришло содержимое сундука от сервера
    protected setData(chest: TCmdChestContent): void {
        super.setData(chest)
        let result_percent = 0
        let fuel_percent = 0
        if (this.state) {
            result_percent = this.state.result_percent
            fuel_percent = this.state.fuel_time / this.state.max_time
        } else {
        }
        this.icon_arrow.clip(0, 0, this.icon_arrow.w * result_percent, this.icon_arrow.h)
        this.icon_fire.clip(0, this.icon_fire.h * (1 - fuel_percent), this.icon_fire.w, this.icon_fire.h)
    }

}