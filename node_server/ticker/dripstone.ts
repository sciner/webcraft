import { ServerClient } from '@client/server_client.js';
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "@client/fluid/FluidConst.js";
import type { TickingBlockManager } from "../server_chunk.js";
import type { ServerWorld } from 'server_world.js';

export default class Ticker {

    static type = 'dripstone';

    //
    static func(this: TickingBlockManager, tick_number : int, world : ServerWorld, chunk, v) {
        const random_tick_speed = world.rules.getRandomTickSpeedValue() / 4096
        const is_tick = Math.random() < random_tick_speed
        if (!is_tick) {
            return
        }
        const pos = v.pos.clone()
        const above = world.getBlock(pos.offset(0, 1, 0))
        if (!above) {
            return
        }
        const updated_blocks = []
        const bm = world.block_manager
        // высота сталактита
        let stalactite = null
        for (let i = 1; i < 8; i++) {
            const block = world.getBlock(pos.offset(0, -i, 0))
            if (!block || block.id != bm.POINTED_DRIPSTONE.id || !block?.extra_data?.up) {
                stalactite = i - 1
                break
            }
        }
        // если вручную поставили больше нормы
        if (stalactite != null) {
            const lava = (above.id == bm.AIR.id && (above.fluid & FLUID_TYPE_MASK) == FLUID_LAVA_ID)
            const water = (above.id == bm.AIR.id && (above.fluid & FLUID_TYPE_MASK) == FLUID_WATER_ID)
            const peak = world.getBlock(pos.offset(0, -stalactite, 0))
            if (peak && peak.id == bm.POINTED_DRIPSTONE.id && (water != peak?.extra_data?.water || lava != peak?.extra_data?.lava)) {
                updated_blocks.push({
                    pos: peak.posworld,
                    item: {
                        id: bm.POINTED_DRIPSTONE.id,
                        extra_data: {
                            up: true,
                            water: water,
                            lava: lava
                        }
                    },
                    action_id: ServerClient.BLOCK_ACTION_MODIFY
                })
            }
            const air = world.getBlock(pos.offset(0,  -stalactite - 1, 0))
            if (air && water && (Math.random() < (random_tick_speed / 10)) && air.id == bm.AIR.id && air.fluid == 0) {
                updated_blocks.push({
                    pos: air.posworld,
                    item: {
                        id: bm.POINTED_DRIPSTONE.id,
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
            let stalagmite = null
            for (let i = stalactite + 1; i < 15; i++) {
                const block = world.getBlock(pos.offset(0, -i, 0))
                if (block && block.id != bm.AIR.id) {
                    stalagmite = i - 1
                    break
                }
            }
            if (stalagmite != null) {
                const ground = world.getBlock(pos.offset(0, -stalagmite - 1, 0))
                if (ground) {
                    if (ground.id == bm.CAULDRON.id) {
                        if ((Math.random() < (random_tick_speed / 20)) && ground.extra_data.level < 3) {
                            updated_blocks.push({
                                pos: ground.posworld,
                                item: {
                                    id: bm.CAULDRON.id,
                                    extra_data: {
                                        level: ground.extra_data.level + 1,
                                        water: water,
                                        lava: lava,
                                        snow: false
                                    }
                                },
                                action_id: ServerClient.BLOCK_ACTION_MODIFY
                            })
                        }
                    }
                    if (stalactite != stalagmite && (ground?.material?.is_solid || (ground.id == bm.POINTED_DRIPSTONE.id && ground?.extra_data?.up == false)) && (Math.random() < (random_tick_speed / 20)) && water) {
                        updated_blocks.push({
                            pos: pos.offset(0, -stalagmite, 0),
                            item: {
                                id: bm.POINTED_DRIPSTONE.id,
                                extra_data: {
                                    up: false
                                }
                            },
                            action_id: ServerClient.BLOCK_ACTION_CREATE
                        })
                    }
                }
            }
        }
        return updated_blocks
    }

}