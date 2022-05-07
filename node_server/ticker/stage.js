import {BLOCK} from "../../www/js/blocks.js";
import {ServerClient} from "../../www/js/server_client.js";

export default class Ticker {

    static type = 'stage'

    //
    static async func(world, chunk, v) {
        const tblock = v.tblock;
        const ticking = v.ticking;
        if(v.ticks % 40 != 0) {
            return;
        }
        const extra_data = tblock.extra_data;
        if(!extra_data) {
            return;
        }
        const updated_blocks = [];
        if(extra_data && extra_data.stage < ticking.max_stage) {
            if(v.ticks % (ticking.times_per_stage * this.chunk.options.STAGE_TIME_MUL) == 0) {
                extra_data.stage++;
                if(extra_data.stage == ticking.max_stage) {
                    extra_data.complete = true;
                }
                updated_blocks.push({pos: v.pos.clone(), item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY});
            }
        } else {
            // Delete completed block from tickings
            this.delete(v.pos);
        }
        return updated_blocks;
    }

}