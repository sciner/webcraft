import { BLOCK } from '../../www/js/blocks.js';
import { Vector } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';
import { WorldAction } from '../../www/js/world_action.js';
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "../../www/js/fluid/FluidConst.js";

export default class Ticker {

    static type = 'chorus';
    
    //
    static func(tick_number, world, chunk, v) {
        if (Math.random() > 0.1) {
            return
        }
        const tblock = v.tblock
        const extra_data = tblock.extra_data
        const pos = v.pos.clone()
        const up = world.getBlock(pos.offset(0, 1, 0))
        if (up && up.id == BLOCK.AIR.id) {
            const age = extra_data.stage;
            if (age < 5) {
                

            }
            console.log(extra_data.stage)
        }
    }

}