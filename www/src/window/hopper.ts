import { INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH, UI_THEME } from "../constant.js";
import { SpriteAtlas } from "../core/sprite_atlas.js";
import { Vector } from "../helpers.js";
import { Lang } from "../lang.js";
import type { PlayerInventory } from "../player_inventory.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class HopperWindow extends BaseChestWindow {

    cell_size : float
    slot_margin : float

    constructor(inventory : PlayerInventory) {

        super(0, 0, INGAME_MAIN_WIDTH, INGAME_MAIN_HEIGHT, 'frmHopper', null, null, inventory, {
            title: Lang.hopper,
            sound: {
                open: null, // {tag: BLOCK.CHARGING_STATION.sound, action: 'open'},
                close: null // {tag: BLOCK.CHARGING_STATION.sound, action: 'close'}
            }
        })

        // Ширина / высота слота
        this.cell_size     = UI_THEME.window_slot_size * this.zoom
        this.slot_margin   = UI_THEME.slot_margin * this.zoom
    }

    //
    prepareSlots() {
        const sz = this.cell_size
        const szm = sz + this.slot_margin
        const resp = []
        const slots_count = 5
        const start_x = UI_THEME.window_padding * this.zoom
        const y = 60 * this.zoom
        for(let i = 0; i < slots_count; i++) {
            resp.push({pos: new Vector(start_x + szm * i, y, 0)})
        }
        return resp
    }

}