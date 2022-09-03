import { BLOCK } from '../../www/js/blocks.js';
import { Vector } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';

const BURN_BLOCKS = [
    {
        id: BLOCK.OAK_PLANKS.id,
        flame: 5,
        burn: 20
    }
];

const FACES = [Vector.XN, Vector.XP, Vector.ZN, Vector.ZP, Vector.YN, Vector.YP];

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
        const updated_blocks = [];
        
        // Проверяем установку блока
        const block = world.getBlock(pos.add(Vector.YN));
        const infiniburn = block.id == BLOCK.NETHERRACK.id; //Бесконечное пламя
        const rain = false; // @todo [rain, burn, fire]
        const age = tblock.extra_data.age; // Время горения
        if (!infiniburn && rain && Math.random() < 0.2 + age * 0.03) {
            updated_blocks.push({pos: pos, item: {id: BLOCK.AIR.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
            return updated_blocks;
        }
        const new_age = Math.min(15, age + rndInt(3) / 2);
        if (age != new_age) {
            tblock.extra_data.age = new_age;
        }
        if (!infiniburn) {
            if (!idBurnPosition(world, pos)) {
                const down = world.getBlock(pos.add(Vector.YN));
                if (down.id == BLOCK.AIR.id || age > 3) {
                    updated_blocks.push({pos: pos, item: {id: BLOCK.AIR.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
                    return updated_blocks;
                }
            }
            if (age >= 15) { 
                updated_blocks.push({pos: pos, item: {id: BLOCK.AIR.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
                return updated_blocks;
            }
        }
        // Поджигаем или уничтожаем соседей
        setFireOrDes(world, pos.add(Vector.XN), 300, age, updated_blocks);
        setFireOrDes(world, pos.add(Vector.XP), 300, age, updated_blocks);
        setFireOrDes(world, pos.add(Vector.ZN), 300, age, updated_blocks);
        setFireOrDes(world, pos.add(Vector.ZP), 300, age, updated_blocks);
        setFireOrDes(world, pos.add(Vector.YN), 250, age, updated_blocks);
        setFireOrDes(world, pos.add(Vector.YP), 250, age, updated_blocks);
        // Распространие огня
        for (let x = -1; x <= 1; ++x) {
            for (let z = -1; z <= 1; ++z) {
                for (let y = -1; y <= 4; ++y) {
                    if (x != 0 || z != 0 || y != 0) {
                        let chance = 100;
                        if (y > 1) {
                            chance += (y - 1) * 100;
                        }
                        const position = pos.offset(x, y, z);
                        const flames = getNeighborFlame(world, position);
                        if (flames > 0) {
                            const burns = (flames + 1) / (age + 30);
                            if (burns > 0 && rndInt(chance) < burns) {
                                console.log("burn!!!");
                                const mod_age = Math.min((age + rndInt(5) / 4), 15);
                                updated_blocks.push({pos: position, item: {id: BLOCK.FIRE.id, extra_data:{age: mod_age}}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
                            }
                        }
                    }
                }
            }
        }
        return updated_blocks;
    }
    
}

// Возможность воспламенения соседних блоков (зависит от материала)
function getNeighborFlame(world, pos) {
    let block = world.getBlock(pos);
    if (!block || block.id != BLOCK.AIR.id) {
        return 0;
    }
    let flames = 0;
    for (const face of FACES) {
        const block = world.getBlock(pos.add(face));
        flames = Math.max(getFlame(block.id), flames);
    }
    return flames;
}

// может ли пламя быть на этой позиции
function idBurnPosition(world, pos) {
    for (const face of FACES) {
        const block = world.getBlock(pos.add(face));
        if (getBurn(block.id) > 0) {
            return true;
        }
    }
    return false;
}

function rndInt(chance) {
    return (Math.random() * chance) | 0;
}

function getFlame(id) {
    for (const block of BURN_BLOCKS) {
        if (block.id == id) {
            return block.flame;
        }
    }
    return 0;
}

function getBurn(id) {
    for (const block of BURN_BLOCKS) {
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