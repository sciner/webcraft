import {BLOCK} from "@client/blocks.js";
import {ServerClient} from "@client/server_client.js";
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
        const updated_blocks = [];
        if(!extra_data || !extra_data.slots) {
            return;
        }
        let charged = 0;
        for(let [slot_index, battery] of Object.entries<any>(extra_data.slots)) {
            const mat = BLOCK.fromId(battery.id);
            if(mat.is_battery) {
                battery.power += 1;
                charged++;
            }
        }
        if(charged > 0) {
            // console.log(`Battery charged count: ${charged}`);
            updated_blocks.push({pos: v.pos.clone(), item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY});
            world.chests.sendChestToPlayers(tblock, null);
        }
        return updated_blocks;
    }

}