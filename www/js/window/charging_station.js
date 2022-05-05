import {BLOCK} from "../blocks.js";
import { BaseChestWindow } from "./chest.js";
import { Vector } from "../helpers.js";

export default class ChargingStationWindow extends BaseChestWindow {

    constructor(x, y, w, h, id, title, text, inventory) {
        super(x, y, w, h, id, title, text, inventory, {
            title: 'Charging station',
            background: './media/gui/form-charging-station.png',
            sound: {
                open: {tag: BLOCK.CHARGING_STATION.sound, action: 'open'},
                close: {tag: BLOCK.CHARGING_STATION.sound, action: 'close'}
            }
        });
    }

    //
    prepareSlots() {
        const resp          = [];
        const fuel_slot_pos = new Vector(52 * this.zoom, 109 * this.zoom, 0);
        const x             = (139 + 6) * this.zoom;
        const y             = (38 + 6) * this.zoom;
        const sx            = 56 * this.zoom;
        const sy            = 56 * this.zoom;
        resp.push({pos: new Vector(fuel_slot_pos.x, fuel_slot_pos.y, 0)});
        resp.push({pos: new Vector(x, y, 0)});
        resp.push({pos: new Vector(x + sx, y, 0)});
        resp.push({pos: new Vector(x + sx * 2, y, 0)});
        resp.push({pos: new Vector(x, y + sy, 0)});
        resp.push({pos: new Vector(x + sx, y + sy, 0)});
        resp.push({pos: new Vector(x + sx * 2, y + sy, 0)});
        return resp;
    }

}