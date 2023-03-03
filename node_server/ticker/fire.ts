import { BLOCK } from '@client/blocks.js';
import { Vector } from '@client/helpers.js';
import { ServerClient } from '@client/server_client.js';
import { BlockUpdates } from './ticker_helpers.js'
import type { TickingBlockManager } from "../server_chunk.js";

const FACES = [Vector.XN, Vector.XP, Vector.ZN, Vector.ZP, Vector.YN, Vector.YP];

export default class Ticker {

    static type = 'fire';

    //
    static func(this: TickingBlockManager, tick_number, world, chunk, v) {
        const random_tick_speed = world.rules.getValue('randomTickSpeed') / 410;
        if (Math.random() >= random_tick_speed) {
            return false;
        }
        const pos = v.pos.clone();
        const extra_data = v.tblock.extra_data;
        const age = extra_data.age;
        const updated = [];
        const block = world.getBlock(pos.add(Vector.YN));
        if (!block) {
            return false;
        }
        if (!isBurnPosition(world, pos) && block.id == BLOCK.AIR.id && block.fluid == 0) {
            updated.push({pos: pos, item: {id: BLOCK.AIR.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
        }
        const infiniburn = (block.id == BLOCK.NETHERRACK.id || block.id == BLOCK.SOUL_SAND.id); //Бесконечное пламя
        if (!infiniburn && world.isRaining() && Math.random() < 0.2 + age * 0.03) {
            return [{pos: pos, item: {id: BLOCK.AIR.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY}];
        } else {
            if (age < 15) {
                extra_data.west = getFlame(world.getBlock(pos.add(Vector.XN))) ? true : false;
                extra_data.east = getFlame(world.getBlock(pos.add(Vector.XP))) ? true : false;
                extra_data.north = getFlame(world.getBlock(pos.add(Vector.ZP))) ? true : false;
                extra_data.south = getFlame(world.getBlock(pos.add(Vector.ZN))) ? true : false;
                extra_data.up = block.id != BLOCK.AIR.id && block.id != BLOCK.FIRE.id  ? true : false;
                extra_data.age = Math.min(15, age + rndInt(3) / 2);
                updated.push({pos: pos, item: {id: BLOCK.FIRE.id, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
            }
            if (!infiniburn) {
                if (!isBurnPosition(world, pos) && age > 3) {
                    return [{pos: pos, item: {id: BLOCK.AIR.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY}];
                }
                if (age >= 15 && rndInt(4) == 0) {
                    return [{pos: pos, item: {id: BLOCK.AIR.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY}];
                }
            }
            const humidity = 0;
            // Поджигаем или уничтожаем соседей
            setFireOrDes(world, pos.add(Vector.XN), 300 + humidity, age, updated);
            setFireOrDes(world, pos.add(Vector.XP), 300 + humidity, age, updated);
            setFireOrDes(world, pos.add(Vector.ZN), 300 + humidity, age, updated);
            setFireOrDes(world, pos.add(Vector.ZP), 300 + humidity, age, updated);
            setFireOrDes(world, pos.add(Vector.YN), 250 + humidity, age, updated);
            setFireOrDes(world, pos.add(Vector.YP), 250 + humidity, age, updated);
            // Распространие огня
            for (let x = -1; x <= 1; x++) {
                for (let z = -1; z <= 1; z++) {
                    for (let y = -1; y <= 4; y++) {
                        if (x != 0 || z != 0 || y != 0) {
                            let chance = 100;
                            if (y > 1) {
                                chance += (y - 1) * 100;
                            }
                            const position = pos.offset(x, y, z);
                            const flames = getNeighborFlame(world, position);
                            if (flames > 0) {
                                const burns = Math.round((flames + 40 + world.rules.getValue('difficulty') * 7) / (age + 30));
                                if (burns > 0 && rndInt(chance) <= burns && !world.isRaining()) {
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
function getNeighborFlame(world, pos) {
    let block = world.getBlock(pos);
    if (!block || block.id == BLOCK.AIR.id || getBurn(block) == 0) {
        return 0;
    }
    let flames = 0;
    for (const face of FACES) {
        block = world.getBlock(pos.add(face));
        flames = Math.max(getFlame(block), flames);
    }
    return flames;
}

// может ли пламя быть на этой позиции
function isBurnPosition(world, pos) {
    for (const face of FACES) {
        const block = world.getBlock(pos.add(face));
        if (block && getBurn(block) > 0) {
            return true;
        }
    }
    return false;
}

function rndInt(chance) {
    return (Math.random() * chance) | 0;
}

function getFlame(block) {
    if (block && block?.material?.flammable?.catch_chance_modifier) {
        return block.material.flammable.catch_chance_modifier;
    }
    return 0;
}

function getBurn(block) {
    if (block && block?.material?.flammable?.destroy_chance_modifier) {
        return block.material.flammable.destroy_chance_modifier;
    }
    return 0;
}

function setFireOrDes(world, pos, chance, age, updated) {
    const block = world.getBlock(pos);
    if (!block || block.id == BLOCK.AIR.id) {
        return;
    }
    const burn = getBurn(block);
    if (rndInt(chance) < burn) {
        if (rndInt(age + 10) < 5) {
            setFireBlock(world, pos, age, updated);
        } else {
            updated.push({pos: pos, item: {id: BLOCK.AIR.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
        }
    }
    if (block.id == BLOCK.TNT.id) {
        updated.push(BlockUpdates.igniteTNT(pos, block));
    }
}

function setFireBlock(world, pos, age, updated) {
    const data = {
        north: false,
        south: false,
        west: false,
        east: false,
        up: true,
        age: Math.min((age + rndInt(5) / 4), 15)
    };
    updated.push({pos: pos, item: {id: BLOCK.FIRE.id, extra_data: data}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
}