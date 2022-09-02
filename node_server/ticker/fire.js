import { BLOCK } from '../../www/js/blocks.js';
import { Vector } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';

const CHANCE_FIRE = [
    {
        id: BLOCK.OAK_PLANKS.id,
        flame: 5,
        burn: 20
    }
];

export default class Ticker {

    static type = 'fire';
    
    //
    static func(world, chunk, v) {
        const tblock = v.tblock;
        const ticking = v.ticking;
        const extra_data = tblock.extra_data;
        const pos = v.pos.clone();

        // only every ~1 sec
        if(v.ticks % 10 != 0) {
            return;
        }
        
        const age = tblock.extra_data.age;
        const updated_blocks = [];
        if (age >= 15) {
            updated_blocks.push({pos: pos, item: {id: BLOCK.AIR.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
        } else {
            const new_age = Math.min(15, age + rndInt(3) / 2);
            if (age != new_age) {
                tblock.extra_data.age = new_age;
            }
            
            // Поджигаем или уничтожаем боковушки
            setFireOrDes(world, pos.add(Vector.XN), 300, age, updated_blocks);
            setFireOrDes(world, pos.add(Vector.XP), 300, age, updated_blocks);
            setFireOrDes(world, pos.add(Vector.ZN), 300, age, updated_blocks);
            setFireOrDes(world, pos.add(Vector.ZP), 300, age, updated_blocks);
            setFireOrDes(world, pos.add(Vector.YN), 250, age, updated_blocks);
            setFireOrDes(world, pos.add(Vector.YP), 250, age, updated_blocks);
            
            // Поджигаем всё что вокруг
            for (let x = -1; x <= 1; ++x) {
                for (let z = -1; z <= 1; ++z) {
                    for (let y = -1; y <= 4; ++y) {
                        if (x != 0 || z != 0 || y != 0) {
                            let chance = 100;
                            if (y > 1) {
                                chance += (y - 1) * 100;
                            }
                            const def_pos = pos.add(new Vector(x, y, z));
                            const flames = getNeighborFlame(world, def_pos);
                            if (flames > 0) {
                                const diff = (flames + 40) / (age + 30);
                                if (diff > 0 && rndInt(chance) < diff) {
                                    console.log("digg: " + chance + " " + diff);
                                    const def_age = Math.min((age + rndInt(5) / 4), 15);
                                    updated_blocks.push({pos: def_pos, item: {id: BLOCK.FIRE.id, extra_data:{age: def_age}}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
                                }
                            }
                        }
                    }
                }
            }
            
        }
        return updated_blocks;
    }
    
}

function getNeighborFlame(world, pos) {
    let block = world.getBlock(pos);
    if (block.id != BLOCK.AIR.id) {
        return 0;
    }
    let flames = 0;
    block = world.getBlock(pos.add(Vector.YP));
    flames = Math.max(getFlame(block.id), flames);
    block = world.getBlock(pos.add(Vector.YN));
    flames = Math.max(getFlame(block.id), flames);
    block = world.getBlock(pos.add(Vector.ZP));
    flames = Math.max(getFlame(block.id), flames);
    block = world.getBlock(pos.add(Vector.ZN));
    flames = Math.max(getFlame(block.id), flames);
    block = world.getBlock(pos.add(Vector.XP));
    flames = Math.max(getFlame(block.id), flames);
    block = world.getBlock(pos.add(Vector.XN));
    flames = Math.max(getFlame(block.id), flames);
    return flames;
}

function rndInt(chance) {
    return (Math.random() * chance) | 0;
}

function getFlame(id) {
    for (const block of CHANCE_FIRE) {
        if (block.id == id) {
            return block.flame;
        }
    }
    return 0;
}

function getBurn(id) {
    for (const block of CHANCE_FIRE) {
        if (block.id == id) {
            return block.burn;
        }
    }
    return 0;
}

function setFireOrDes(world, pos, chance, age, updated) {
    const block = world.getBlock(pos);
    if (!block || block.id == BLOCK.AIR.id) {
        return;
    }
    const burn = getBurn(block.id);
    if (rndInt(chance) < burn) {
        if (rndInt(age + 10) < 5) {
            const def_age = Math.min((age + rndInt(5) / 4), 15);
            updated.push({pos: pos, item: {id: BLOCK.FIRE.id, extra_data:{age: def_age}}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
        } else {
            updated.push({pos: pos, item: {id: BLOCK.AIR.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
        }
    }
}