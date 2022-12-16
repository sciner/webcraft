import { Vector } from "../../www/js/helpers.js";
import { WorldAction } from "../../www/js/world_action.js";
import { BlockUpdates } from './ticker_helpers.js'

export default class Ticker {

    static type = 'tnt';
    
    static func(tick_number, world, chunk, v) {
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        const pos = v.pos.clone(); // don't use a shared variable, it gets passed out of function

        // only every ~0.5 sec
        if(tick_number % 10 != 0) {
            return;
        }
        
        if (extra_data.explode) {
            extra_data.fuse++;
            if (extra_data.fuse >= 8) {
                const actions = new WorldAction(null, world, false, false);
                actions.makeExplosion(pos, 3, true, 1/3, 6);
                actions.addPlaySound({ tag: 'madcraft:block.creeper', action: 'explode', pos: pos });
                world.actions_queue.add(null, actions);
            }
        } else {
            // Check if the nearby blocks (except the lower one) have lava.
            for (const dxyz of Vector.ZERO_AND_SIX_DIRECTIONS_CUMULATIVE) {
                pos.addSelf(dxyz);
                if (chunk.isLava(pos)) { // replace with isFluid() for testing
                    return [BlockUpdates.igniteTNT(v.pos.clone(), tblock)];
                }
            }
        }
    }
    
}