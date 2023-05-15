import { Vector } from '@client/helpers.js';
import { ServerClient } from '@client/server_client.js';
import { WorldAction } from '@client/world_action.js';
import { FLUID_TYPE_MASK, FLUID_WATER_ID } from "@client/fluid/FluidConst.js";
import type { TickingBlockManager } from "../server_chunk.js";
import type { ServerWorld } from 'server_world.js';

// Проверка позиции для установки арбуза
function getFreePosition(world, pos) {
    const sides = [Vector.XN, Vector.XP, Vector.ZN, Vector.ZP];
    const BLOCK = world.block_manager
    const facing = [];
    for(const side of sides) {
        const position = pos.add(side);
        const body = world.getBlock(position);
        const under = world.getBlock(position.add(Vector.YN));
        if (!body || !under || (body.id == BLOCK.MELON.id || body.id == BLOCK.PUMPKIN.id)) {
            return;
        }
        if (body.id == BLOCK.AIR.id && (under.material.material.id == 'dirt' || under.material.material.id == 'sand')) { //dirt grass sand
            facing.push(side);
        }
    }
    if (facing.length > 0) {
        const rnd_facing = (Math.random() * facing.length) | 0;
        if (rnd_facing == facing.length) {
            return;
        }
        return facing[rnd_facing];
    }
    return;
}

export default class Ticker {

    static type = 'stage';

    //
    static func(this: TickingBlockManager, tick_number : int, world : ServerWorld, chunk, v) {
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        if (!extra_data?.bone) {
            extra_data.bone = 0;
        }
        const random_tick_speed = world.rules.getRandomTickSpeedValue() / 4096
        const is_tick = Math.random() < random_tick_speed;
        const is_bone = extra_data.bone > 0;
        if (!is_tick && !is_bone) {
            return;
        }
        const ticking = v.ticking;
        if (is_tick) {
            extra_data.stage = Math.min(extra_data.stage + 1, ticking.max_stage);
        }
        if (is_bone) {
            extra_data.stage = Math.min(extra_data.stage + extra_data.bone, ticking.max_stage);
            extra_data.bone = 0;
        }
        const BLOCK = world.block_manager
        const pos = v.pos.clone();
        if (tblock.id == BLOCK.KELP.id) { // Эти блоки растут вверх, копируя основание. При срубании, рост продолжен, но в воде
            // проверяем срубили ли кусок
            let stage = 0, block = null;
            for (stage = 1; stage < extra_data.height - 1; stage++) {
                block = world.getBlock(pos.offset(0, stage, 0));
                if (block?.id != tblock.id) {
                    break;
                }
            }
            if (block && block.id == BLOCK.AIR.id && (block.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID) {
                return [{pos: pos.offset(0, stage, 0), item: {id: tblock.id, extra_data: {notick: true} }, action_id: ServerClient.BLOCK_ACTION_CREATE}];
            }
        } else if (tblock.id == BLOCK.SUGAR_CANE.id || tblock.id == BLOCK.CACTUS.id) { // Эти блоки растут вверх, копируя основание. При срубании, рост продолжен
            // проверяем срубили ли кусок
            let stage = 0;
            for (stage = 1; stage < ticking.max_stage - 1; stage++) {
                if (world.getBlock(pos.offset(0, stage, 0))?.id != tblock.id) {
                    break;
                }
            }
            const block = world.getBlock(pos.offset(0, stage, 0));
            if (block?.id == BLOCK.AIR.id) {
                return [{pos: pos.offset(0, stage, 0), item: {id: tblock.id, extra_data: {notick: true} }, action_id: ServerClient.BLOCK_ACTION_CREATE}];
            }
        } else if (tblock.id == BLOCK.MELON_SEEDS.id || tblock.id == BLOCK.PUMPKIN_SEEDS.id) { // Эти блоки растут как семена в области одного блока, но по истечению роста дают плоды
            if (extra_data.stage == ticking.max_stage) {
                const side = getFreePosition(world, pos);
                if (side && is_tick) {
                    const item = (tblock.id == BLOCK.MELON_SEEDS.id ) ? BLOCK.MELON.id : BLOCK.PUMPKIN.id;
                    return [{pos: pos.add(side), item: {id: item}, action_id: ServerClient.BLOCK_ACTION_CREATE}];
                }
            } else {
                return [{pos: pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY}];
            }
        } else if (tblock.material.tags.includes('sapling')) { // Это саженцы, по окончанию роста они превращются в деревья
            if (extra_data.stage == ticking.max_stage) {
                const params = {
                    pos: pos,
                    block: tblock.convertToDBItem()
                };
                const actions = new WorldAction(null, world, false, false);
                actions.generateTree(params);
                world.actions_queue.add(null, actions);
                return;
            }
            return [{pos: pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY}];
        } else { // Эти блоки растут как семена в области одного блока. По истечению роста, действий больше нет
            if (extra_data.stage == ticking.max_stage) {
                extra_data.notick = true;
                tblock.extra_data.complete = true;
            }
            return [{pos: pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY}];
        }
    }

}