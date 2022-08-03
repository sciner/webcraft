import { BLOCK } from '../../www/js/blocks.js';
import { Vector, DIRECTION } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';
import { TBlock } from '../../www/js/typed_blocks.js';

export default class Ticker {

    static type = 'stage'
    
    static SIDES = ['SOUTH', 'EAST', 'NORTH', 'WEST'];

    //
    static func(world, chunk, v) {
        const tblock = v.tblock;
        const ticking = v.ticking;
        const pos = v.pos.clone();
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
                
                //create melon
                if (extra_data.complete) {
                    if (tblock.id == BLOCK.MELON_SEEDS.id) {
                        const BLOCK_CACHE = Array.from({length: 6}, _ => new TBlock(null, new Vector(0, 0, 0)));
                        const neighbours  = tblock.tb.getNeighbours(tblock, null, BLOCK_CACHE);
                        for (let side of Ticker.SIDES) {
                            if (neighbours[side].id == BLOCK.AIR.id) {
                                tblock.rotate = new Vector(0, DIRECTION[side], 0); //Повоорт хвостика
                                updated_blocks.push({pos: neighbours[side].posworld, item: {id: BLOCK.MELON.id}, action_id: ServerClient.BLOCK_ACTION_CREATE});
                                break;
                            }
                        }
                    }
                }
                
                updated_blocks.push({pos: pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY});
            }
        } else {
            // Delete completed block from tickings
            this.delete(v.pos);
        }
        return updated_blocks;
    }

}