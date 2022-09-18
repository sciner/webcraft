import {BLOCK} from "../../www/js/blocks.js";
import { Vector } from "../../www/js/helpers.js";
import {ServerClient} from "../../www/js/server_client.js";

export default class Ticker {

    static type = 'dirt'

    //
    static func(tick_number, world, chunk, v) {
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        if(!extra_data || isNaN(extra_data.max_ticks)) {
            return this.delete(v.pos);
        }
        const updated_blocks = [];
        if(tick_number % extra_data.max_ticks == 0) {
            const over1 = world.getBlock(v.pos.add(new Vector(0, 1, 0)));
            if(over1 && over1.id == BLOCK.AIR.id) {
                updated_blocks.push({pos: v.pos.clone(), item: {id: BLOCK.GRASS_BLOCK.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
            } else {
                // clear extra_data
                updated_blocks.push({pos: v.pos.clone(), item: {id: BLOCK.DIRT.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
            }
            // Delete block from tickings list
            this.delete(v.pos);
        }
        return updated_blocks;
    }

}