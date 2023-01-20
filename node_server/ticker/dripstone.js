import { BLOCK } from '../../www/js/blocks.js';
import { ServerClient } from '../../www/js/server_client.js';
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "../../www/js/fluid/FluidConst.js";

export default class Ticker {

    static type = 'dripstone';
    
    //
    static func(tick_number, world, chunk, v) {
        const setFluid = (water, lava) => {
            if (!stalactite) {
                return;
            }
            const peak = world.getBlock(pos.offset(0, 1 - stalactite, 0));
            if (!peak || peak.id != BLOCK.POINTED_DRIPSTONE.id) {
                return;
            }
            if (water != peak?.extra_data?.water || lava != peak?.extra_data?.lava) {
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
            }
        }
        if (tick_number % 10 != 0) {
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
        const random_tick_speed = world.rules.getValue('randomTickSpeed') / 4096;
        if (stalactite) {
            const lava = (under.id == BLOCK.AIR.id && (under.fluid & FLUID_TYPE_MASK) == FLUID_LAVA_ID);
            const water = (under.id == BLOCK.AIR.id && (under.fluid & FLUID_TYPE_MASK) == FLUID_WATER_ID); 
            if (lava || water) {
                if (water && (Math.random() < (random_tick_speed / 10))) {
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
                } else {
                    setFluid(water, lava);
                }
                // высота сталагмита
                let stalagmite = null;
                for (let i = stalactite + 1; i < 11; i++) {
                    const block = world.getBlock(pos.offset(0, -i, 0));
                    if (block && block.id != BLOCK.AIR.id) {
                        stalagmite = i - 1;
                        break;
                    }
                }
                if (stalagmite) {
                    const cauldron = world.getBlock(pos.offset(0, -stalagmite - 1, 0));
                    if (cauldron) {
                        if (cauldron.id == BLOCK.CAULDRON.id) {
                            if ((Math.random() < (random_tick_speed / 20)) && cauldron.extra_data.level < 3) {
                                updated_blocks.push({
                                    pos: cauldron.posworld, 
                                    item: { 
                                        id: BLOCK.CAULDRON.id, 
                                        extra_data: { 
                                            level: cauldron.extra_data.level + 1,
                                            water: water,
                                            lava: lava,
                                            snow: false
                                        }
                                    }, 
                                    action_id: ServerClient.BLOCK_ACTION_MODIFY 
                                });
                            } 
                        } else if (cauldron.id != 0 && (Math.random() < (random_tick_speed / 20)) && water) {
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
                }
            } else {
                setFluid(false, false);
            }
        } else {
            setFluid(false, false);
        }
 
        return updated_blocks;
    }

}