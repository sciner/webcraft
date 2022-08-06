import {BLOCK} from '../../www/js/blocks.js';
import {ServerClient} from '../../www/js/server_client.js';
import { Vector } from '../../www/js/helpers.js';
import { TBlock } from '../../www/js/typed_blocks3.js';

export default class Ticker {

    static type = 'stage'

    //
    static func(world, chunk, v) {
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
                //Если блок это сахарный тросник
                if (tblock.id == BLOCK.SUGAR_CANES.id) {
                    const pos = v.pos.clone().add(new Vector(0, extra_data.stage, 0));
                    const block = world.getBlock(pos);
                    //Если наверху преграда
                    if (block.id != BLOCK.AIR.id) {
                        extra_data.stage = ticking.max_stage;
                        extra_data.complete = true;
                    } else {
                        updated_blocks.push({
                            pos: pos, 
                            item: {
                                id: BLOCK.SUGAR_CANES.id,
                                extra_data: {
                                    stage: ticking.max_stage
                                }
                            }, 
                            action_id: ServerClient.BLOCK_ACTION_CREATE
                        });
                    }
                } else {
                    updated_blocks.push({pos: v.pos.clone(), item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY});
                }
            }
        } else {
            // Delete completed block from tickings
            this.delete(v.pos);
        }
        return updated_blocks;
    }

}