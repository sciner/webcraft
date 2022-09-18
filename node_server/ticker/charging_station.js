import {BLOCK} from "../../www/js/blocks.js";
import {ServerClient} from "../../www/js/server_client.js";

export default class Ticker {

    static type = 'charging_station'

    //
    static func(tick_number, world, chunk, v) {
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
        for(let [slot_index, battery] of Object.entries(extra_data.slots)) {
            const mat = BLOCK.fromId(battery.id);
            if(mat.is_battery) {
                battery.power += 1;
                charged++;
            }
        }
        if(charged > 0) {
            // console.log(`Battery charged count: ${charged}`);
            updated_blocks.push({pos: v.pos.clone(), item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY});
            world.chests.sendChestToPlayers(v.pos.clone(), []);
        }
        return updated_blocks;
    }

}