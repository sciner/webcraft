import { AIR_BLOCK_SIMPLE, BLOCK } from '@client/blocks.js';
import { Vector } from '@client/helpers.js';
import { BLOCK_ACTION } from '@client/server_client.js';
import { BlockUpdates } from './ticker_helpers.js'
import type { ServerChunk, TickingBlockManager } from "../server_chunk.js";
import type { ServerWorld } from 'server_world.js';
import type { TBlock } from '@client/typed_blocks3.js';

const FACES = [Vector.XN, Vector.XP, Vector.ZN, Vector.ZP, Vector.YN, Vector.YP]
const _pos = new Vector(0, 0, 0)
const _pos2 = new Vector(0, 0, 0)

declare type ITickingBlock = {
    pos: Vector,
    tblock: TBlock
}

export default class Ticker {

    static type = 'fire';

    //
    static func(this: TickingBlockManager, tick_number : int, world : ServerWorld, chunk : ServerChunk, v : ITickingBlock) : boolean | IUpdateBlock[] {
        const random_tick_speed = world.rules.getRandomTickSpeedValue() / 410;
        if (Math.random() >= random_tick_speed) {
            return false;
        }
        const pos = v.pos.clone();
        const extra_data = v.tblock.extra_data;
        const age = extra_data.age;
        const updated : IUpdateBlock[] = []
        const block = world.getBlock(pos.add(Vector.YN));
        if (!block) {
            return false;
        }
        if (!isBurnPosition(world, pos) && block.id == BLOCK.AIR.id && block.fluid == 0) {
            updated.push({pos: pos.clone(), item: AIR_BLOCK_SIMPLE, action_id: BLOCK_ACTION.MODIFY})
        }
        const infiniburn = (block.id == BLOCK.NETHERRACK.id || block.id == BLOCK.SOUL_SAND.id); //Бесконечное пламя
        if (!infiniburn && world.isRaining() && Math.random() < 0.2 + age * 0.03) {
            return [{pos, item: AIR_BLOCK_SIMPLE, action_id: BLOCK_ACTION.MODIFY}]
        } else {
            if (age < 15) {
                extra_data.west = getFlame(world.getBlock(_pos.copyFrom(pos).addSelf(Vector.XN))) != 0
                extra_data.east = getFlame(world.getBlock(_pos.copyFrom(pos).addSelf(Vector.XP))) != 0
                extra_data.north = getFlame(world.getBlock(_pos.copyFrom(pos).addSelf(Vector.ZP))) != 0
                extra_data.south = getFlame(world.getBlock(_pos.copyFrom(pos).addSelf(Vector.ZN))) != 0
                extra_data.up = block.id != BLOCK.AIR.id && block.id != BLOCK.FIRE.id
                extra_data.age = Math.min(15, age + rndInt(3) / 2);
                updated.push({pos, item: {id: BLOCK.FIRE.id, extra_data: extra_data}, action_id: BLOCK_ACTION.MODIFY});
            }
            if (!infiniburn) {
                if (!isBurnPosition(world, pos) && age > 3) {
                    return [{pos, item: AIR_BLOCK_SIMPLE, action_id: BLOCK_ACTION.MODIFY}];
                }
                if (age >= 15 && rndInt(4) == 0) {
                    return [{pos, item: AIR_BLOCK_SIMPLE, action_id: BLOCK_ACTION.MODIFY}];
                }
            }
            const humidity = 0;
            // Поджигаем или уничтожаем соседей
            setFireOrDes(world, _pos.copyFrom(pos).addSelf(Vector.XN), 300 + humidity, age, updated)
            setFireOrDes(world, _pos.copyFrom(pos).addSelf(Vector.XP), 300 + humidity, age, updated)
            setFireOrDes(world, _pos.copyFrom(pos).addSelf(Vector.ZN), 300 + humidity, age, updated)
            setFireOrDes(world, _pos.copyFrom(pos).addSelf(Vector.ZP), 300 + humidity, age, updated)
            setFireOrDes(world, _pos.copyFrom(pos).addSelf(Vector.YN), 250 + humidity, age, updated)
            setFireOrDes(world, _pos.copyFrom(pos).addSelf(Vector.YP), 250 + humidity, age, updated)
            const add_difficulty = 40 + world.rules.getValue('difficulty') * 7
            const is_raining = world.isRaining()
            // Распространие огня
            for (let x = -1; x <= 1; x++) {
                for (let z = -1; z <= 1; z++) {
                    for (let y = -1; y <= 4; y++) {
                        if (x != 0 || z != 0 || y != 0) {
                            let chance = 100;
                            if (y > 1) {
                                chance += (y - 1) * 100;
                            }
                            const position = _pos.copyFrom(pos).offsetSelf(x, y, z)
                            const flames = getNeighborFlame(world, position);
                            if (flames > 0) {
                                const burns = Math.round((flames + add_difficulty) / (age + 30));
                                if (burns > 0 && rndInt(chance) <= burns && !is_raining) {
                                    setFireBlock(world, position, age, updated);
                                }
                            }
                        }
                    }
                }
            }
        }
        return updated;
    }

}

// Возможность воспламенения соседних блоков (зависит от материала)
function getNeighborFlame(world : ServerWorld, pos : Vector) : number {
    let block = world.getBlock(pos);
    if (!block || block.id == BLOCK.AIR.id || getBurn(block) == 0) {
        return 0;
    }
    let flames = 0;
    for (const face of FACES) {
        block = world.getBlock(_pos2.copyFrom(pos).addSelf(face))
        flames = Math.max(getFlame(block), flames);
    }
    return flames;
}

// может ли пламя быть на этой позиции
function isBurnPosition(world : ServerWorld, pos : Vector) : boolean {
    for (const face of FACES) {
        const block = world.getBlock(_pos2.copyFrom(pos).addSelf(face));
        if (block && getBurn(block) > 0) {
            return true;
        }
    }
    return false;
}

function rndInt(chance : float) : int {
    return (Math.random() * chance) | 0;
}

function getFlame(block : TBlock) : number {
    return block?.material?.flammable?.catch_chance_modifier ?? 0
}

function getBurn(block? : TBlock) : number {
    return block?.material?.flammable?.destroy_chance_modifier ?? 0
}

function setFireOrDes(world : ServerWorld, pos : Vector, chance : float, age, updated : IUpdateBlock[]) {
    const block = world.getBlock(pos);
    if (!block || block.id == BLOCK.AIR.id) {
        return;
    }
    const burn = getBurn(block);
    if (rndInt(chance) < burn) {
        if (rndInt(age + 10) < 5) {
            setFireBlock(world, pos, age, updated);
        } else {
            updated.push({pos: pos.clone(), item: AIR_BLOCK_SIMPLE, action_id: BLOCK_ACTION.MODIFY});
        }
    }
    if (block.id == BLOCK.TNT.id) {
        updated.push(BlockUpdates.igniteTNT(pos, block));
    }
}

function setFireBlock(world : ServerWorld, pos : Vector, age, updated : IUpdateBlock[]) {
    const data = {
        north: false,
        south: false,
        west: false,
        east: false,
        up: true,
        age: Math.min((age + rndInt(5) / 4), 15)
    };
    updated.push({pos: pos.clone(), item: {id: BLOCK.FIRE.id, extra_data: data}, action_id: BLOCK_ACTION.MODIFY});
}