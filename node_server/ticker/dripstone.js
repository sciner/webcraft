import { BLOCK } from '../../www/js/blocks.js';
import { Vector } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';
import { WorldAction } from '../../www/js/world_action.js';
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "../../www/js/fluid/FluidConst.js";

export default class Ticker {

    static type = 'dripstone';
    
    //
    static func(tick_number, world, chunk, v) {
        const random_stage_speed = 10 / 4096;
        const random_tick_speed = 100 / 4096;
        const is_tick = Math.random() > random_tick_speed;
        if (is_tick) {
            return;
        }
        const pos = v.pos.clone();
        const updated_blocks = [];
        const under = world.getBlock(pos.offset(0, 1, 0));
        if (!under) {
            return;
        }
        // высота сталактита
        let stalactite = null;
        for (let i = 1; i < 7; i++) {
            const block = world.getBlock(pos.offset(0, -i, 0));
            if (block && block.id == BLOCK.AIR.id && block.fluid == 0) {
                stalactite = i;
                break;
            }
        }
        let peak = null;
        if (stalactite) {
            peak = world.getBlock(pos.offset(0, 1-stalactite, 0));
            const lava = (under.id == BLOCK.AIR.id && (under.fluid & FLUID_TYPE_MASK) == FLUID_LAVA_ID);
            const water = (under.id == BLOCK.AIR.id && (under.fluid & FLUID_TYPE_MASK) == FLUID_WATER_ID); 
            // проверка жидкости над блоком
            if (peak && peak.id == BLOCK.POINTED_DRIPSTONE.id && (peak?.extra_data?.lava != lava || peak?.extra_data?.water != water)) {
                updated_blocks.push({
                    pos: peak.posworld,
                    item: {
                        id: BLOCK.POINTED_DRIPSTONE.id,
                        extra_data: {
                            up: true,
                            water: water,
                            lava: lava
                        }
                    },
                    action_id: ServerClient.BLOCK_ACTION_MODIFY
                });
            } else if (water) {
                if (Math.random() < 0.02) {
                    updated_blocks.push({
                        pos: pos.offset(0, -stalactite, 0),
                        item: {
                            id: BLOCK.POINTED_DRIPSTONE.id,
                            extra_data: {
                                up: true,
                                water: true,
                                lava: false
                            }
                        },
                        action_id: ServerClient.BLOCK_ACTION_CREATE
                    });
                }
                // высота сталагмита
                let stalagmite = null;
                for (let i = stalactite + 1; i < 11; i++) {
                    block = world.getBlock(pos.offset(0, -i, 0));
                    if (block && block.id != BLOCK.AIR.id) {
                        stalagmite = i - 1;
                        break;
                    }
                }
                // вариация роста сталагмита
                if (stalagmite && Math.random() < 0.01) {
                    updated_blocks.push({
                        pos: pos.offset(0, -stalagmite, 0), 
                        item: { 
                            id: BLOCK.POINTED_DRIPSTONE.id, 
                            extra_data: { 
                                up: false 
                            } 
                        }, 
                        action_id: ServerClient.BLOCK_ACTION_CREATE 
                    });
                }
            }

/*



            if (water) {
                if (Math.random() < 0.8) {
                    updated_blocks.push({
                        pos: pos.offset(0, -stalactite, 0),
                        item: {
                            id: BLOCK.POINTED_DRIPSTONE.id,
                            extra_data: {
                                up: true,
                                water: true,
                                lava: false
                            }
                        },
                        action_id: ServerClient.BLOCK_ACTION_CREATE
                    });
                } else if (peak && peak.id == BLOCK.POINTED_DRIPSTONE.id && !peak?.water) {
                    updated_blocks.push({
                        pos: peak.posworld,
                        item: {
                            id: BLOCK.POINTED_DRIPSTONE.id,
                            extra_data: {
                                up: true,
                                water: true,
                                lava: false
                            }
                        },
                        action_id: ServerClient.BLOCK_ACTION_MODIFY
                    });
                }

            } else if (lava && peak && peak.id == BLOCK.POINTED_DRIPSTONE.id && !peak?.lava) {
                updated_blocks.push({
                    pos: peak.posworld,
                    item: {
                        id: BLOCK.POINTED_DRIPSTONE.id,
                        extra_data: {
                            up: true,
                            water: false,
                            lava: true
                        }
                    },
                    action_id: ServerClient.BLOCK_ACTION_MODIFY
                });  
            } else if (peak?.lava || peak?.water) {
                console.log('clear')
                updated_blocks.push({
                    pos: peak.posworld,
                    item: {
                        id: BLOCK.POINTED_DRIPSTONE.id,
                        extra_data: {
                            up: true,
                            water: false,
                            lava: false
                        }
                    },
                    action_id: ServerClient.BLOCK_ACTION_MODIFY
                }); 
            }
/*
            
            
            
            if (peak && peak.id == BLOCK.POINTED_DRIPSTONE.id && (peak?.lava != lava || peak?.water != water)) {
                updated_blocks.push({
                    pos: peak.posworld,
                    item: {
                        id: BLOCK.POINTED_DRIPSTONE.id,
                        extra_data: {
                            up: true,
                            water: water,
                            lava: lava
                        }
                    },
                    action_id: ServerClient.BLOCK_ACTION_MODIFY
                });
            } else if (water) {
                if (Math.random() < 0.8) {
                    updated_blocks.push({
                        pos: pos.offset(0, -stalactite, 0),
                        item: {
                            id: BLOCK.POINTED_DRIPSTONE.id,
                            extra_data: {
                                up: true,
                                water: true,
                                lava: false
                            }
                        },
                        action_id: ServerClient.BLOCK_ACTION_CREATE
                    });
                }
            }
             вариация роста сталактита
            if (under.id == BLOCK.AIR.id && (under.fluid & FLUID_TYPE_MASK) == FLUID_WATER_ID) {
                if (Math.random() < 0.8) {
                    updated_blocks.push({
                        pos: pos.offset(0, -stalactite, 0),
                        item: {
                            id: BLOCK.POINTED_DRIPSTONE.id,
                            extra_data: {
                                up: true,
                                water: true,
                                lava: false
                            }
                        },
                        action_id: ServerClient.BLOCK_ACTION_CREATE
                    });
                } else if (!peak?.extra_data?.water) {
                    
                }
                
            }*/
        }

        /*
        // сталактит будет рости, если над блоком есть вода
        if (block.id == BLOCK.AIR.id && (block.fluid & FLUID_TYPE_MASK) == FLUID_WATER_ID) {
            // высота сталактита
            let stalactite = null;
            for (let i = 1; i < 7; i++) {
                block = world.getBlock(pos.offset(0, -i, 0));
                if (block && block.id == BLOCK.AIR.id && block.fluid == 0) {
                    stalactite = i;
                    break;
                }
            }
            // если есть место внизу, то ростем вниз
            if (stalactite) {
                // вариация роста сталактита
                if (Math.random() < 0.8) {
                    updated_blocks.push({
                        pos: pos.offset(0, -stalactite, 0),
                        item: {
                            id: BLOCK.POINTED_DRIPSTONE.id,
                            extra_data: {
                                up: true,
                                water: true
                            }
                        },
                        action_id: ServerClient.BLOCK_ACTION_CREATE
                    });
                }
                // высота сталагмита
                let stalagmite = null;
                for (let i = stalactite + 1; i < 11; i++) {
                    block = world.getBlock(pos.offset(0, -i, 0));
                    if (block && block.id != BLOCK.AIR.id) {
                        stalagmite = i - 1;
                        break;
                    }
                }
                // вариация роста сталагмита
                if (stalagmite && Math.random() < 0.6) {
                    updated_blocks.push({
                        pos: pos.offset(0, -stalagmite, 0), 
                        item: { 
                            id: BLOCK.POINTED_DRIPSTONE.id, 
                            extra_data: { 
                                up: false 
                            } 
                        }, 
                        action_id: ServerClient.BLOCK_ACTION_CREATE 
                    });
                }
            }
        }*/
        return updated_blocks;
    }

}