import { Vector } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';
import { WorldAction } from '../../www/js/world_action.js';
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "../../www/js/fluid/FluidConst.js";

const FACES = [Vector.XN, Vector.XP, Vector.ZN, Vector.ZP];

export default class Ticker {

    static type = 'chorus';
    
    //
    static func(tick_number, world, chunk, v) {
        const replaceGrownFlower = (pos, stage) => {
            return [
                {
                    pos: pos, 
                    item: {
                        id: BLOCK.CHORUS_PLANT.id
                    }, 
                    action_id: ServerClient.BLOCK_ACTION_MODIFY
                },
                {
                    pos: pos.offset(0, 1, 0), 
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
        if (Math.random() > 0.1) {
            return
        }
        const BLOCK = world.block_manager
        const tblock = v.tblock
        const extra_data = tblock.extra_data
        const pos = v.pos.clone()
        const pos_up = pos.offset(0, 1, 0)
        let block = world.getBlock(pos_up)
        // если на верху препятствие
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
        if (block.id == BLOCK.END_STONE.id || (block.id == BLOCK.AIR.id && block.fluid == 0)) {
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
        if (isGo && !isNeighbors(world, pos_up)) {
            return [
                {
                    pos: pos, 
                    item: {
                        id: BLOCK.CHORUS_PLANT.id
                    }, 
                    action_id: ServerClient.BLOCK_ACTION_MODIFY
                },
                {
                    pos: pos_up, 
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
        if (stage < 4) {
            let j = rndInt(4)
            if (isEnd) {
                j++
            }
            let isDead = false
            for (let l = 0; l < j; l++) {
                const x = rndInt(3) - 1
                const z = (x == 0) ? rndInt(3) - 1 : 0
                const pos_next = pos.offset(x, 0, z)
                block = world.getBlock(pos_next)
                if (block && block.id == 0 && block.fluid == 0 && !isNeighbors(world, pos_next)) {
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
                            id: BLOCK.CHORUS_FLOWER.id,
                            extra_data: {
                                stage: stage + 1
                            }
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
/*


        const BLOCK = world.block_manager
        const tblock = v.tblock
        const extra_data = tblock.extra_data
        const pos = v.pos.clone()
        let block = world.getBlock(pos.offset(0, 1, 0))
        if (block && block.id == BLOCK.AIR.id) {
            const stage = extra_data.stage
            block = world.getBlock(pos.offset(0, -1, 0))
            if (!block) {
                return
            }
            // растем если внизу водух или 
            if (block.id == BLOCK.END_STONE.id || (block.id == BLOCK.AIR.id && block.fluid == 0)) {
                return replaceGrownFlower(pos, stage)
            }
            let isEnd = false
            if (block.id == BLOCK.CHORUS_PLANT.id) {
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
                    return replaceGrownFlower(pos, stage)
                }
            }
            if (stage < 4) {
                let j = rndInt(4)
                if (isEnd) {
                    j++
                }
                for (let l = 0; l < j; l++) {
                    let position = getRandomDirection(pos)
                    block = world.getBlock(position)
                    if (block && block.id == BLOCK.AIR.id && !isNeighbors(world, position)) {
                        return [
                            {
                                pos: position, 
                                item: {
                                    id: BLOCK.CHORUS_FLOWER.id,
                                    extra_data: {
                                        stage: stage + 1
                                    }
                                }, 
                                action_id: ServerClient.BLOCK_ACTION_MODIFY
                            }
                        ]
                    }
                }
            }
        }
        
        /*let block = world.getBlock(pos.offset(0, 1, 0))
        if (block && block.id == BLOCK.AIR.id) {
            const stage = extra_data.stage
            if (stage < 5) {
                // если внизу блок, на котором может быть рост
                block = world.getBlock(pos.offset(0, -1, 0))
                if (!block) {
                    return
                }
                let isGo = false
                let isEnd = false
                if (block.id == BLOCK.END_STONE.id || (block.id == BLOCK.AIR.id && block.fluid == 0)) {
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

                if (isGo) {
                    
                } 

                if (stage < 4) {
                    let j = rndInt(4)
                    if (isEnd) {
                        j++
                    }
                    for (let l = 0; l < j; l++) {
                        const next_pos = pos.offset(rndInt(2) - 1, 0, rndInt(2) - 1)
                        block = world.getBlock(pos.offset(x, 0, z))

                    }

                    console.log('sdfdsfsf')
                }

            }
           
        }*/
    } 

}

function getRandomDirection(pos) {
    const x = rndInt(3) - 1
    const z = (x == 0) ? rndInt(3) - 1 : 0
    return pos.offset(x, 0, z)
}

// Есть ли соседи у блока
function isNeighbors(world, pos) {
    for (const face of FACES) {
        const block = world.getBlock(pos.add(face));
        if (!block || block.id != 0 || block.fluid != 0) {
            return false
        }
    }
    return true
}

function rndInt(chance) {
    return (Math.random() * chance) | 0
}