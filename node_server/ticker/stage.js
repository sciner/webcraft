import { BLOCK } from '../../www/js/blocks.js';
import { Vector, DIRECTION } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';

export default class Ticker {

    static type = 'stage'
    
    //
    static func(tick_number, world, chunk, v) {
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        if(!extra_data) {
            return;
        }
        const ticking = v.ticking;
        const pos = v.pos.clone();
        const mul = 4 * world.getGeneratorOptions('sapling_speed_multipliyer', 1);
        if (tblock.id == BLOCK.CARROT_SEEDS.id || tblock.id == BLOCK.WHEAT_SEEDS.id) { // Эти блоки растут как семена в области одного блока. По истечению роста, действий больше нет
            if (extra_data.stage >= ticking.max_stage) {
                extra_data.notick = true;
                this.delete(v.pos); // @todo Надо его удалять из тикера
                return;
            }
            if(tick_number % (ticking.times_per_stage * mul) == 0) {
                extra_data.stage++;
                return [{pos: pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY}];
            }
        }
        if (tblock.id == BLOCK.MELON_SEEDS.id) { // Эти блоки растут как семена в области одного блока, но по истечению роста дают плоды
            // Проверка позиции для установки арбуза
            const getFreePosition = () => {
                const sides = [Vector.XN, Vector.XP, Vector.ZN, Vector.ZP];
                const facing = [];
                for(const side of sides) {
                    const position = pos.add(side);
                    const body = world.getBlock(position);
                    const under = world.getBlock(position.add(Vector.YN));
                    if (body.id == BLOCK.AIR.id && under.id != BLOCK.AIR.id) {
                        facing.push(side);
                    }
                    if (body.id == BLOCK.MELON.id) {
                        return;
                    }
                }
                if (facing.length > 0) {
                    const rnd_facing = Math.random() * (facing.length - 1) | 0;
                    return facing[rnd_facing];
                }
                return;
            };
            if (extra_data.stage >= ticking.max_stage) {
                const updated_blocks = [];
                if(tick_number % (ticking.times_per_stage * mul) == 0) {
                    const side = getFreePosition();
                    if (side) {
                        if (side.equal(Vector.XN)) {
                            extra_data.facing = DIRECTION.WEST;
                        } else if(side.equal(Vector.XP)) {
                            extra_data.facing = DIRECTION.EAST;
                        } else if(side.equal(Vector.ZN)) {
                            extra_data.facing = DIRECTION.SOUTH;
                        } else {
                            extra_data.facing = DIRECTION.NORTH;
                        }
                        updated_blocks.push({pos: pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY});
                        updated_blocks.push({pos: pos.add(side), item: {id: BLOCK.MELON.id}, action_id: ServerClient.BLOCK_ACTION_CREATE});
                    }
                }
                return updated_blocks;
            }
            if(tick_number % (ticking.times_per_stage * mul) == 0) {
                extra_data.stage++;
                return [{pos: pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY}];
            }
        }
        if (tblock.id == BLOCK.MELON_SEEDS.id) { // Эти блоки растут как семена в области одного блока, но по истечению роста дают плоды
        
        
        
        /*const tblock = v.tblock;
        const ticking = v.ticking;
        const pos = v.pos.clone();
        const extra_data = tblock.extra_data;
        if(!extra_data) {
            return;
        }
        const updated_blocks = [];
        if(extra_data && extra_data.stage < ticking.max_stage) {
            const mul = 4 * world.getGeneratorOptions('sapling_speed_multipliyer', 1);
            if(tick_number % (ticking.times_per_stage * mul) == 0) {
                // Если семена арбуза
                if(tblock.id == BLOCK.MELON_SEEDS.id) {
                    // Проверка позиции для установки арбуза
                    const getFreePosition = () => {
                        const sides = [Vector.XN, Vector.XP, Vector.ZN, Vector.ZP];
                        for(let side of sides) {
                            const position = pos.add(side);
                            const body = world.getBlock(position);
                            if(body.id != BLOCK.AIR.id) {
                                continue;
                            }
                            const under = world.getBlock(position.add(new Vector(0, -1, 0)));
                            if(under.id != BLOCK.AIR.id) {
                                return side;
                            }
                        }
                        return false;
                    };
                    // Если семена готовы дать плод
                    if(extra_data.stage == ticking.max_stage - 1) {
                        const side = getFreePosition();
                        if(side) {
                            // Повоорт хвостика
                            let direction = DIRECTION.NORTH;
                            if(side.equal(Vector.XN)) {
                                direction = DIRECTION.WEST;
                            } else if(side.equal(Vector.XP)) {
                                direction = DIRECTION.EAST;
                            } else if(side.equal(Vector.ZN)) {
                                direction = DIRECTION.SOUTH;
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
                } else if (tblock.id == BLOCK.SUGAR_CANE.id) {
                    // Если блок это сахарный тростник
                    const over_pos = v.pos.clone().addScalarSelf(0, 1, 0);
                    if(extra_data.pos) {
                        if(over_pos.y < extra_data.pos.y + extra_data.max_height) {
                            const over_block = world.getBlock(over_pos);
                            // Если наверху нет преграды
                            if(over_block.id == BLOCK.AIR.id) {
                                updated_blocks.push({
                                    pos: over_pos, 
                                    item: {
                                        id: BLOCK.SUGAR_CANE.id,
                                        extra_data: {
                                            stage:      over_pos.y - extra_data.pos.y,
                                            pos:        new Vector(extra_data.pos),
                                            max_height: extra_data.max_height
                                        }
                                    }, 
                                    action_id: ServerClient.BLOCK_ACTION_CREATE
                                });
                            }
                        }
                    }
                    // @todo need refactor this method for delete ticking blocks
                    // this.delete(v.pos);
                    extra_data.notick = true;
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
        */
    }

}