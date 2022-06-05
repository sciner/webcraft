import {BLOCK} from "../blocks.js";
import { Vector } from "../helpers.js";
import { BaseChestWindow } from "./base_chest_window.js";

export class ChargingStationWindow extends BaseChestWindow {

    constructor(inventory) {

        super(10, 10, 352, 332, 'frmChargingStation', null, null, inventory, {
            title: 'Charging station',
            background: {
                image: './media/gui/form-charging-station.png',
                image_size_mode: 'sprite',
                sprite: {
                    mode: 'stretch',
                    x: 0,
                    y: 0,
                    width: 352 * 2,
                    height: 332 * 2
                }
            },
            sound: {
                open: {tag: BLOCK.CHARGING_STATION.sound, action: 'open'},
                close: {tag: BLOCK.CHARGING_STATION.sound, action: 'close'}
            }
        });

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