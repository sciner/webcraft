import {Vector} from "../../www/src/helpers.js";
import {ServerClient} from "../../www/src/server_client.js";
import type { ServerChunk } from "../server_chunk.js";
import type { ServerWorld } from "../server_world.js";
import type { TickingBlockManager } from "../server_chunk.js";

export default class Ticker {

    static type = 'bamboo'

    //
    static func(this: TickingBlockManager, tick_number : int, world : ServerWorld, chunk : ServerChunk, v, check_pos : Vector, ignore_coords) {
        const tblock = v.tblock;
        const ticking = v.ticking;
        const extra_data = tblock.extra_data;
        const updated_blocks = [];
        check_pos.copyFrom(v.pos);
        check_pos.y = 0;
        if(ignore_coords.has(check_pos)) {
            return;
        }
        if(extra_data && extra_data.stage < ticking.max_stage) {
            const mul = 4 * world.getGeneratorOptions('sapling_speed_multipliyer', 1);
            if(tick_number % (ticking.times_per_stage * mul) == 0) {
                //
                function addNextBamboo(pos, block, stage) {
                    const next_pos = pos.clone();
                    next_pos.y++;
                    const new_item = {
                        id: block.id,
                        extra_data: {...block.extra_data}
                    };
                    new_item.extra_data.stage = stage;
                    const b = world.getBlock(next_pos);
                    if(!b || b.id == 0 || b.material.material.is_leaves) {
                        updated_blocks.push({pos: next_pos, item: new_item, action_id: ServerClient.BLOCK_ACTION_CREATE});
                        // игнорировать в этот раз все другие бамбуки на этой позиции без учета вертикальной позиции
                        check_pos.copyFrom(next_pos);
                        check_pos.y = 0;
                        ignore_coords.set(check_pos, true);
                        return true;
                    }
                    return false;
                }
                //
                if(extra_data.stage == 0) {
                    addNextBamboo(v.pos, tblock, 1);
                    tblock.extra_data = null; // .stage = 3;
                    updated_blocks.push({pos: v.pos.clone(), item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY});
                } else {
                    const over1 = world.getBlock(v.pos.add(Vector.YP));
                    const under1 = world.getBlock(v.pos.add(Vector.YN));
                    if(extra_data.stage == 1) {
                        if(!over1 || over1.id == 0 || over1.material.material.id == 'leaves') {
                            if(under1.id == tblock.id && (!under1.extra_data || under1.extra_data.stage == 3)) {
                                addNextBamboo(v.pos, tblock, 1);
                            }
                            if(under1.id == tblock.id && under1.extra_data && under1.extra_data.stage == 1) {
                                addNextBamboo(v.pos, tblock, 2);
                            }
                        } else if(over1.id == tblock.id && under1.id == tblock.id) {
                            if(over1.extra_data.stage == 2 && under1.extra_data && under1.extra_data.stage == 1) {
                                if(addNextBamboo(over1.posworld, tblock, 2)) {
                                    if(under1.extra_data.stage == 1) {
                                        const new_item = {...tblock.convertToDBItem()};
                                        new_item.extra_data = {...extra_data};
                                        new_item.extra_data = null; // .stage = 3;
                                        updated_blocks.push({pos: under1.posworld, item: new_item, action_id: ServerClient.BLOCK_ACTION_MODIFY});
                                    }
                                }
                            }
                        }
                    } else {
                        if(extra_data.stage == 2 && extra_data.pos) {
                            if(over1 && under1 && over1.id == tblock.id && under1.id == tblock.id) {
                                if(!over1.extra_data || !under1.extra_data) {
                                    console.log('TODO: Errorrrr... 2');
                                    return
                                }
                                if(over1.extra_data.stage == 2 && under1.extra_data.stage == 1) {
                                    if(over1.posworld.distance(extra_data.pos) < extra_data.max_height - 1) {
                                        if(addNextBamboo(over1.posworld, tblock, 2)) {
                                            // replace current to 1
                                            const new_current = {...tblock.convertToDBItem()};
                                            new_current.extra_data = {...extra_data};
                                            new_current.extra_data.stage = 1;
                                            updated_blocks.push({pos: v.pos.clone(), item: new_current, action_id: ServerClient.BLOCK_ACTION_MODIFY});
                                            // set under to 3
                                            const new_under = {...tblock.convertToDBItem()};
                                            new_under.extra_data = {...new_under.extra_data};
                                            new_under.extra_data = null; // .stage = 3;
                                            updated_blocks.push({pos: under1.posworld, item: new_under, action_id: ServerClient.BLOCK_ACTION_MODIFY});
                                        }
                                    } else {
                                        // Limit height
                                        let pos = v.pos.clone();
                                        extra_data.notick = true;
                                        delete(extra_data.pos);
                                        delete(extra_data.max_height);
                                        updated_blocks.push({pos: pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY});
                                        this.delete(pos);
                                        //
                                        const new_under = {...tblock.convertToDBItem()};
                                        new_under.extra_data = {...under1.extra_data};
                                        new_under.extra_data.notick = true;
                                        delete(new_under.extra_data.pos);
                                        delete(new_under.extra_data.max_height);
                                        updated_blocks.push({pos: under1.posworld, item: new_under, action_id: ServerClient.BLOCK_ACTION_MODIFY});
                                        this.delete(under1.posworld);
                                        //
                                        const new_over = {...tblock.convertToDBItem()};
                                        new_over.extra_data = {...over1.extra_data};
                                        new_over.extra_data.notick = true;
                                        delete(new_over.extra_data.pos);
                                        delete(new_over.extra_data.max_height);
                                        updated_blocks.push({pos: over1.posworld, item: new_over, action_id: ServerClient.BLOCK_ACTION_MODIFY});
                                        this.delete(over1.posworld);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else {
            // Delete completed block from tickings
            this.delete(v.pos);
        }
        return updated_blocks;
    }

}