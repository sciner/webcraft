import {BLOCK} from "../blocks.js";
import { SpriteAtlas } from "../core/sprite_atlas.js";
import { Vector } from "../helpers.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class ChargingStationWindow extends BaseChestWindow {

    constructor(inventory) {

        super(10, 10, 352, 332, 'frmChargingStation', null, null, inventory, {
            title: 'Charging station',
            sound: {
                open: {tag: BLOCK.CHARGING_STATION.sound, action: 'open'},
                close: {tag: BLOCK.CHARGING_STATION.sound, action: 'close'}
            }
        })

        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/form-charging-station.png').then(async atlas => {
            this.setBackground(await atlas.getSprite(0, 0, 352 * 2, 332 * 2), 'none', this.zoom / 2.0)
        })

    }

    //
    prepareSlots() {
        const resp          = [];
        const x             = (139 + 6) * this.zoom;
        const y             = (38 + 6) * this.zoom;
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
        const fuel_slot_pos = new Vector(52 * this.zoom, 108 * this.zoom, 0);
        resp.push({pos: new Vector(fuel_slot_pos.x, fuel_slot_pos.y, 0)});
        return resp;
    }

}