import { BLOCK } from "../../www/js/blocks.js";
import { Vector, Helpers } from "../../www/js/helpers.js";
import { ServerClient } from "../../www/js/server_client.js";

function isLightOpacity(block) {
    if (block.id == BLOCK.AIR.id || block.id == BLOCK.GLASS_PANE.id || block.id == BLOCK.GLASS.id || block.id == BLOCK.IRON_BARS.id || block.id == BLOCK.COBWEB.id) {
        return true;
    }
    return false;
}

export default class Ticker {

    static type = 'grass'

    //
    static func(tick_number, world, chunk, v) {

        throw 'deprecated';

        const random_tick_speed = world.getGameRule('randomTickSpeed') / 4096;
        const is_tick = Math.random() < random_tick_speed;
        if (!is_tick) {
            return;
        }
        const pos = v.pos.clone();
        
        // трава зачахла
        if (world.getLight() < 4 && !isLightOpacity(world.getBlock(pos.offset(0, 1, 0)))) {
            console.log("grass->dirt");
            return [{pos: pos, item: {id: BLOCK.DIRT.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY}];
        } else {
            // возможность распространеия 3х5х3
            if (world.getLight() >= 9) {
                for (let i = 0; i < 4; i++) {
                    const rnd_pos = pos.offset(Helpers.getRandomInt(-1, 2), Helpers.getRandomInt(-2, 3), Helpers.getRandomInt(-1, 2));
                    const rnd_block = world.getBlock(rnd_pos);
                    const rnd_up_block = world.getBlock(rnd_pos.offset(0, 1, 0));
                    if (rnd_block.id == BLOCK.DIRT.id && isLightOpacity(rnd_up_block)) {
                        const tblock = v.tblock;
                        return [{pos: rnd_pos, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY}];
                    }
                }
            }
        }
       
    }

}