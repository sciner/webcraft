import { BLOCK_ACTION } from '@client/server_client.js';
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "@client/fluid/FluidConst.js";
import type { TickingBlockManager } from "../server_chunk.js";
import type { ServerWorld } from 'server_world.js';
import type { Vector } from '@client/helpers.js';

const MAX_HEIGHT = 16

export default class Ticker {

    static type = 'dripstone';

    //
    static func(this: TickingBlockManager, tick_number : int, world : ServerWorld, chunk, v) {

        const setPointedDripstone = (position: Vector, up: boolean, lava: boolean, water: boolean) => {
            updated_blocks.push({
                pos: position,
                item: {
                    id: bm.POINTED_DRIPSTONE.id,
                    extra_data: {
                        stage: 0,
                        up: up,
                        water: water,
                        lava: lava
                    }
                },
                action_id: BLOCK_ACTION.MODIFY
            })
        } 

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
        for (let i = 1; i < MAX_HEIGHT / 2; i++) {
            const block = world.getBlock(pos.offset(0, -i, 0))
            if (!block || block.id != bm.POINTED_DRIPSTONE.id || !block.extra_data?.up) {
                stalactite = i - 1
                break
            }
        }
        // если вручную поставили больше нормы
        if (stalactite != null) {
            const lava = (above.id == bm.AIR.id && (above.fluid & FLUID_TYPE_MASK) == FLUID_LAVA_ID)
            const water = (above.id == bm.AIR.id && (above.fluid & FLUID_TYPE_MASK) == FLUID_WATER_ID)
            const peak = world.getBlock(pos.offset(0, -stalactite, 0))
            if (peak?.id == bm.POINTED_DRIPSTONE.id && peak.extra_data?.stage == 0 && (water != peak.extra_data.water || lava != peak.extra_data.lava)) {
                setPointedDripstone(peak.posworld, true, lava, water)
            } else {
                const air = world.getBlock(pos.offset(0, -stalactite - 1, 0))
                if (air?.id == bm.AIR.id && air.fluid == 0 && Math.random() < (random_tick_speed / 10) && water) {
                    setPointedDripstone(air.posworld, true, false, true)
                }
            }
            // высота сталагмита
            let stalagmite = null
            for (let i = stalactite + 1; i < MAX_HEIGHT; i++) {
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
                                action_id: BLOCK_ACTION.MODIFY
                            })
                        }
                    } else if (stalactite != stalagmite && (ground?.material?.is_solid || (ground.id == bm.POINTED_DRIPSTONE.id && !ground.extra_data?.up)) && (Math.random() < (random_tick_speed / 20)) && water) {
                        setPointedDripstone(pos.offset(0, -stalagmite, 0), false, false, false)
                    }
                }
            }
        }
        return updated_blocks
    }

}