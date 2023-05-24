import {BLOCK} from "@client/blocks.js";
import type { TickingBlockManager } from "../server_chunk.js";

export default class Ticker {

    static type = 'charging_station'

    //
    static func(this: TickingBlockManager, tick_number, world, chunk, v) {
        if(tick_number % 80 != 0) {
            return;
        }
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        if(!extra_data || !extra_data.slots) {
            return;
        }
        let charged = 0;
        for(let battery of Object.values<any>(extra_data.slots)) {
            const mat = BLOCK.fromId(battery.id);
            if(mat.is_battery) {
                battery.power += 1;
                charged++;
            }
        }
        if(charged > 0) {
            // console.log(`Battery charged count: ${charged}`);
            world.saveSendExtraData(tblock)
        }
        return null
    }

}