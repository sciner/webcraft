import {Vector} from "../../www/js/helpers.js";
import {BLOCK} from "../../www/js/blocks.js";
import {ServerClient} from "../../www/js/server_client.js";

export default class Ticker {

    static type = 'spawnmob'

    //
    static async func(world, chunk, v) {
        const tblock = v.tblock;
        const ticking = v.ticking;
        const extra_data = tblock.extra_data;
        const updated_blocks = [];
        if(v.ticks % extra_data.max_ticks == 0) {
            const spawn_pos = v.pos.clone().addSelf(new Vector(.5, 0, .5));
            const params = {
                type           : extra_data.type,
                skin           : extra_data.skin,
                pos            : spawn_pos,
                pos_spawn      : spawn_pos.clone(),
                rotate         : new Vector(0, 0, 0).toAngles()
            };
            // Spawn mob
            console.log('Spawn mob', v.pos.toHash());
            await world.mobs.create(params);
            updated_blocks.push({pos: v.pos.clone(), item: {id: BLOCK.AIR.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
            // Delete completed block from tickings
            this.delete(v.pos);
        }
        if(!extra_data) {
            return;
        }
        return updated_blocks;
    }

}