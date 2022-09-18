import { WorldAction } from "../../www/js/world_action.js";

export default class Ticker {

    static type = 'tnt';
    
    //
    static func(tick_number, world, chunk, v) {
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        const pos = v.pos.clone();

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
        }
        
        return [];
    }
    
}