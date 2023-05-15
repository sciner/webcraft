import { Vector } from '@client/helpers.js'
import { ServerClient } from '@client/server_client.js'
import type { ServerWorld } from 'server_world.js';
import type { TickingBlockManager } from "../server_chunk.js";

const FACES = [Vector.XN, Vector.XP, Vector.ZN, Vector.ZP]

export default class Ticker {

    static type = 'chorus'

    //
    static func(this: TickingBlockManager, tick_number : int, world : ServerWorld, chunk, v) {
        const tisk_speed = world.rules.getRandomTickSpeedValue() / 4096
        if (Math.random() > tisk_speed) {
            return
        }
        const BLOCK = world.block_manager
        const extra_data = v.tblock.extra_data
        const pos = v.pos.clone()
        const above = pos.offset(0, 1, 0)
        let block = world.getBlock(above)
        // если наверху препятствие
        if (!block || block.id != 0 || block.fluid != 0) {
            return
        }
        const stage = extra_data.stage
        // вырос куст, отключаем тикер
        if (stage >= 5) {
            return [
                {
                    pos: pos,
                    item: {
                        id: BLOCK.CHORUS_FLOWER.id,
                        extra_data: {
                            notick: true
                        }
                    },
                    action_id: ServerClient.BLOCK_ACTION_MODIFY
                }
            ]
        }
        // рост куста вверх
        block = world.getBlock(pos.offset(0, -1, 0))
        if (!block) {
            return
        }
        let isGo = false
        let isEnd = false
        if (block.id == BLOCK.END_STONE.id || (block.id == 0 && block.fluid == 0)) {
            isGo = true
        } else if (block.id == BLOCK.CHORUS_PLANT.id) {
            let k
            for (k = 0; k < 4; k++) {
                block = world.getBlock(pos.offset(0, -(k + 2), 0))
                if (!block || block.id != BLOCK.CHORUS_PLANT.id) {
                    if (block.id == BLOCK.END_STONE.id) {
                        isEnd = true
                    }
                    break
                }
            }
            if (k == 0 || k <= rndInt(isEnd ? 4 : 3)) {
                isGo = true
            }
        }
        if (isGo && !isNeighbors(world, above)) {
            return [
                {
                    pos: pos,
                    item: {
                        id: BLOCK.CHORUS_PLANT.id
                    },
                    action_id: ServerClient.BLOCK_ACTION_MODIFY
                },
                {
                    pos: above,
                    item: {
                        id: BLOCK.CHORUS_FLOWER.id,
                        extra_data: {
                            stage: stage
                        }
                    },
                    action_id: ServerClient.BLOCK_ACTION_MODIFY
                }
            ]
        }
        const updated = []
        let age = rndInt(4)
        if (isEnd) {
            age++
        }
        let isDead = false
        for (let l = 0; l < age; l++) {
            const x = rndInt(3) - 1
            const z = (x == 0) ? rndInt(3) - 1 : 0
            const pos_next = pos.offset(x, 0, z)
            block = world.getBlock(pos_next)
            if (block && block.id == 0 && block.fluid == 0 && !isNeighbors(world, pos_next, pos)) {
                updated.push(
                    {
                        pos: pos_next,
                        item: {
                            id: BLOCK.CHORUS_FLOWER.id,
                            extra_data: {
                                stage: stage + 1
                            }
                        },
                        action_id: ServerClient.BLOCK_ACTION_MODIFY
                    }
                )
                isDead = true
            }
        }
        if (isDead) {
            updated.push(
                {
                    pos: pos,
                    item: {
                        id: BLOCK.CHORUS_PLANT.id
                    },
                    action_id: ServerClient.BLOCK_ACTION_MODIFY
                }
            )
        } else {
            updated.push(
                {
                    pos: pos,
                    item: {
                        id: BLOCK.CHORUS_FLOWER.id,
                        extra_data: {
                            notick: true
                        }
                    },
                    action_id: ServerClient.BLOCK_ACTION_MODIFY
                }
            )
        }
        return updated

    }

}

// Есть ли соседи у блока
function isNeighbors(world, pos, ignore?) {
    for (const face of FACES) {
        const position = pos.add(face)
        if (ignore && position.equal(ignore)) {
            continue
        }
        const block = world.getBlock(position)
        if (!block || block.id != 0 || block.fluid != 0) {
            return true
        }
    }
    return false
}

function rndInt(chance) {
    return (Math.random() * chance) | 0
}