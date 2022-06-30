import {BLOCK} from "../../www/js/blocks.js";
import {ServerClient} from "../../www/js/server_client.js";

export default class Ticker {

    static type = 'dirt'

    //
    static async func(world, chunk, v) {
        const tblock = v.tblock;
        const ticking = v.ticking;
        const extra_data = tblock.extra_data;
        const updated_blocks = [];
        if(v.ticks % extra_data.max_ticks == 0) {
            updated_blocks.push({pos: v.pos.clone(), item: {id: BLOCK.GRASS_BLOCK.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
            // Delete completed block from tickings
            this.delete(v.pos);
        }
        if(!extra_data) {
            return;
        }
        return updated_blocks;
    }

}