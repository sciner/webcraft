import { BLOCK } from '../../www/js/blocks.js';
import { Vector, DIRECTION } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';
import { TBlock } from '../../www/js/typed_blocks.js';

export default class Ticker {

    static type = 'stage'
    
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
                //Если семена арбуза
                if (tblock.id == BLOCK.MELON_SEEDS.id) {
                    //Проверка позиции для установки арбуза
                    const getFreePosition = () => {
                        const sides = [Vector.XN, Vector.XP, Vector.ZN, Vector.ZP];
                        for (let side of sides) {
                            let position = pos.add(side);
                            let body = world.getBlock(position);
                            if (body.id != BLOCK.AIR.id) {
                                continue;
                            }
                            let under = world.getBlock(position.add(new Vector(0, -1, 0)));
                            if (under.id != BLOCK.AIR.id) {
                                return side;
                            }
                        }
                        return false;
                    };
                    
                    if (extra_data.stage == ticking.max_stage - 1) {
                        const side = getFreePosition();
                        if (side) {
                            //Повоорт хвостика
                            let direction = DIRECTION.NORTH;
                            switch(side) {
                                case Vector.XN: 
                                    direction = DIRECTION.WEST;
                                    break;
                                case Vector.XP: 
                                    direction = DIRECTION.EAST;
                                    break;
                                case Vector.ZN: 
                                    direction = DIRECTION.SOUTH;
                                    break;
                            }
                            tblock.rotate = new Vector(0, direction, 0);
                            extra_data.stage = ticking.max_stage;
                            extra_data.complete = true;
                            updated_blocks.push({pos: pos.add(side), item: {id: BLOCK.MELON.id}, action_id: ServerClient.BLOCK_ACTION_CREATE});
                        }
                    } else {
                        extra_data.stage++;
                    }
                    updated_blocks.push({pos: pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY});
                } else {
                    extra_data.stage++;
                    if(extra_data.stage == ticking.max_stage) {
                        extra_data.complete = true;
                    }
                    updated_blocks.push({pos: pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY});
                }
            }
        } else {
            // Delete completed block from tickings
            this.delete(v.pos);
        }
        return updated_blocks;
    }

}