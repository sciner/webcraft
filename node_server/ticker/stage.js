import { BLOCK } from '../../www/js/blocks.js';
import { Vector, DIRECTION } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';
import { WorldAction } from '../../www/js/world_action.js';

// Проверка позиции для установки арбуза
function getFreePosition(world, pos) {
    const sides = [Vector.XN, Vector.XP, Vector.ZN, Vector.ZP];
    const facing = [];
    for(const side of sides) {
        const position = pos.add(side);
        const body = world.getBlock(position);
        const under = world.getBlock(position.add(Vector.YN));
        if (body.id == BLOCK.AIR.id && under.id != BLOCK.AIR.id) {
                        facing.push(side);
                    }
                    if (body.id == BLOCK.MELON.id || body.id == BLOCK.PUMPKIN.id) {
                        return;
                    }
                }
                if (facing.length > 0) {
                    const rnd_facing = Math.random() * (facing.length - 1) | 0;
                    return facing[rnd_facing];
                }
                return;
}

export default class Ticker {

    static type = 'stage'
    
    //
    static func(tick_number, world, chunk, v) {
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        if(!extra_data) {
            return;
        }
        const ticking = v.ticking;
        const pos = v.pos.clone();
        const mul = 4 * world.getGeneratorOptions('sapling_speed_multipliyer', 1);
        const per_stage = ticking?.times_per_stage ? ticking.times_per_stage : 8;
        if(tick_number % (per_stage * mul) == 0) {
            if (tblock.id == BLOCK.SUGAR_CANE.id) { // Эти блоки растут вверх, копируя основание. При срубании, рост продолжен
                // проверяем срубили ли кусок
                let stage = 0;
                for (stage = 1; stage < ticking.max_stage - 1; stage++) {
                    if (world.getBlock(pos.offset(0, stage, 0)).id != tblock.id) {
                        break;
                    }
                }
                const block = world.getBlock(pos.offset(0, stage, 0));
                if (block.id == BLOCK.AIR.id) {
                    return [{pos: pos.offset(0, stage, 0), item: {id: tblock.id, extra_data: {notick: true}}, action_id: ServerClient.BLOCK_ACTION_CREATE}];
                }
            } else if (tblock.id == BLOCK.MELON_SEEDS.id || tblock.id == BLOCK.PUMPKIN_SEEDS.id) { // Эти блоки растут как семена в области одного блока, но по истечению роста дают плоды 
                if (extra_data.stage > ticking.max_stage) {
                    const side = getFreePosition(world, pos);
                    if (side) {
                        return [{pos: pos.add(side), item: {id: (tblock.id == BLOCK.MELON_SEEDS.id ) ? BLOCK.MELON.id : BLOCK.PUMPKIN.id}, action_id: ServerClient.BLOCK_ACTION_CREATE}];
                    }
                } else {
                    extra_data.stage++;
                    return [{pos: pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY}];
                }
            } else if (tblock.material.tags.includes('sapling')) { // Это саженцы, по окончанию роста они превращются в деревья 
                extra_data.stage++;
                if (extra_data.stage > extra_data.max_ticks) { // @todo ticking.max_stage;
                    delete(extra_data.ticking);
                    const params = {
                        pos: v.pos.clone(),
                        block: tblock.convertToDBItem()
                    };
                    const actions = new WorldAction(null, world, false, false);
                    actions.generateTree(params);
                    world.actions_queue.add(null, actions);
                    return;
                }
                return [{pos: pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY}];
            } else { // Эти блоки растут как семена в области одного блока. По истечению роста, действий больше нет
                extra_data.stage++;
                if (extra_data.stage > ticking.max_stage) {
                    delete(extra_data.ticking);
                    this.delete(v.pos);
                    return
                }
                return [{pos: pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY}];
            }
        }
    }

}