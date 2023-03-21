import type { BLOCK } from "../blocks.js";
import { SpriteAtlas } from "../core/sprite_atlas.js";
import { Vector } from "../helpers.js";
import { Lang } from "../lang.js";
import { Label } from "../ui/wm.js";
import { BaseChestWindow } from "./base_chest_window.js";
import { getBlockImage } from "./tools/blocks.js";

export class ChargingStationWindow extends BaseChestWindow {

    constructor(inventory) {

        const bm : BLOCK = inventory.player.world.block_manager

        const w = 420
        const h = 400

        super(0, 0, w, h, 'frmChargingStation', null, null, inventory, {
            title: Lang.charging_station,
            sound: {
                open: {tag: bm.CHARGING_STATION.sound, action: 'open'},
                close: {tag: bm.CHARGING_STATION.sound, action: 'close'}
            }
        })

        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/form-charging-station.png').then(async atlas => {
            this.setBackground(await atlas.getSprite(0, 0, w * 2, h * 2), 'none', this.zoom / 2.0)
        })

        const lblIcon = new Label(49 * this.zoom, 52 * this.zoom, 40 * this.zoom, 40 * this.zoom, 'lblIcon')
        lblIcon.setIcon(getBlockImage(bm.fromName('CHARGING_STATION')), 'centerstretch', 1.0, 0)
        this.add(lblIcon)

    }

    //
    prepareSlots() {
        const resp          = [];
        const x             = (139 + 12) * this.zoom;
        const y             = (38 + 16) * this.zoom;
        const sx            = 56 * this.zoom;
        const sy            = 56 * this.zoom;
        // charger slots
        resp.push({pos: new Vector(x, y, 0)});
        resp.push({pos: new Vector(x + sx, y, 0)});
        resp.push({pos: new Vector(x + sx * 2, y, 0)});
        resp.push({pos: new Vector(x, y + sy, 0)});
        resp.push({pos: new Vector(x + sx, y + sy, 0)});
        resp.push({pos: new Vector(x + sx * 2, y + sy, 0)});
        // fuel
        const fuel_slot_pos = new Vector(52 * this.zoom, 123 * this.zoom, 0);
        resp.push({pos: new Vector(fuel_slot_pos.x, fuel_slot_pos.y, 0), size: 32 * this.zoom});
        return resp;
    }

}