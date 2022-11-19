import { BLOCK } from '../../www/js/blocks.js';
import { Vector } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';
import { WorldAction } from '../../www/js/world_action.js';
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "../../www/js/fluid/FluidConst.js";

export default class Ticker {

    static type = 'dripstone';
    
    //
    static func(tick_number, world, chunk, v) {
        const random_tick_speed = 100 / 4096;
        const is_tick = Math.random() > random_tick_speed;
        if (is_tick) {
            return;
        }
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        const pos = v.pos.clone();
        const updated_blocks = [];
        // сталактит будет рости, если над блоком есть вода
        let block = world.getBlock(pos.offset(0, 1, 0));
        if (!block || block.id != BLOCK.AIR.id || (block.fluid & FLUID_TYPE_MASK) != FLUID_WATER_ID) {
            return;
        }
        // высота сталактита
        let stalactite = null;
        for (let i = 1; i < 6; i++) {
            block = world.getBlock(pos.offset(0, -i, 0));
            if (block && block.id == BLOCK.AIR.id && block.fluid == 0) {
                stalactite = i;
                break;
            }
        }
        // если есть место внизу, то ростем вниз
        if (stalactite) {
            // вариация роста сталактита
            if (Math.random() < 0.8) {
                updated_blocks.push({pos: pos.offset(0, -stalactite, 0), item: {id: BLOCK.POINTED_DRIPSTONE.id, extra_data: {up: true} }, action_id: ServerClient.BLOCK_ACTION_CREATE});
                block = world.getBlock(pos.offset(0, 2 - stalactite, 0));
                if (block.id == BLOCK.POINTED_DRIPSTONE.id) {
                    updated_blocks.push({pos: pos.offset(0, 2 - stalactite, 0), item: {id: BLOCK.POINTED_DRIPSTONE.id, extra_data: {up: true} }, action_id: ServerClient.BLOCK_ACTION_MODIFY});
                }
            }
            // высота сталагмита
            let stalagmite = null;
            for (let i = stalactite + 1; i < 11; i++) {
                let block = world.getBlock(pos.offset(0, -i, 0));
                if (block && block.id != BLOCK.AIR.id) {
                    stalagmite = i - 1;
                    break;
                }
            }
            // вариация роста сталагмита
            if (stalagmite && Math.random() < 0.6) {
                updated_blocks.push({pos: pos.offset(0, -stalagmite, 0), item: {id: BLOCK.POINTED_DRIPSTONE.id, extra_data: {up: false} }, action_id: ServerClient.BLOCK_ACTION_CREATE});
                block = world.getBlock(pos.offset(0, -stalagmite - 2, 0));
                if (block.id == BLOCK.POINTED_DRIPSTONE.id) {
                    updated_blocks.push({pos: pos.offset(0, -stalagmite - 2, 0), item: {id: BLOCK.POINTED_DRIPSTONE.id, extra_data: {up: false} }, action_id: ServerClient.BLOCK_ACTION_MODIFY});
                }
            }
        }
        return updated_blocks;
    }

}