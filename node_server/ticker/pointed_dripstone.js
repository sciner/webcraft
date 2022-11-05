import { BLOCK } from '../../www/js/blocks.js';
import { Vector } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';
import { WorldAction } from '../../www/js/world_action.js';
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "../../www/js/fluid/FluidConst.js";

export default class Ticker {

    static type = 'pointed_dripstone';
    
    //
    static func(tick_number, world, chunk, v) {
        const random_tick_speed = world.rules.getValue('randomTickSpeed') / 4096;
        const is_tick = Math.random() > random_tick_speed;
        if (is_tick) {
            return;
        }
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        const ticking = v.ticking;
        const pos = v.pos.clone();
        if (tblock.id == BLOCK.POINTED_DRIPSTONE.id) { 
            // проверяем срубили ли кусок
            let stage = 0;
            for (stage = 1; stage < 6; stage++) {
                if (world.getBlock(pos.offset(0, -stage, 0)).id != tblock.id) {
                    break;
                }
            }
            const block = world.getBlock(pos.offset(0, -stage, 0));
            if (block.id == BLOCK.AIR.id) {
                return [{pos: pos.offset(0, -stage, 0), item: {id: tblock.id, extra_data: {notick: true} }, action_id: ServerClient.BLOCK_ACTION_CREATE}];
            }
            /*// находим сталагмит
            for (let stage = extra_data.stage; stage < (11 + extra_data.stage); stage++) {
                let block = world.getBlock(pos.offset(0, -stage, 0));
                if (block.id != BLOCK.) {
                    break;
                }
            }
            */
            
        } 
    }

}