import { WorldAction } from "../../www/js/world_action.js";

export default class Ticker {

    static type = 'sapling'

    //
    static func(world, chunk, v) {
        const tblock = v.tblock;
        const ticking = v.ticking;
        const extra_data = tblock.extra_data;
        const updated_blocks = [];
        if(v.ticks % extra_data.max_ticks == 0) {
            const params = {
                pos: v.pos,
                block: tblock.convertToDBItem()
            };
            const actions = new WorldAction(null, world, false, false);
            actions.generateTree(params);
            world.actions_queue.add(null, actions);
        }
        if(!extra_data) {
            return;
        }
        return updated_blocks;
    }

}