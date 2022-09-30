import { WorldAction } from "../../www/js/world_action.js";
import { Vector } from "../../www/js/helpers.js";
import { ServerClient } from "../../www/js/server_client.js";

export default class Ticker {

    static type = 'chicken_nest'

    //
    static func(tick_number, world, chunk, v) {
        const tblock = v.tblock;
        const extra_data = tblock.extra_data;
        const updated_blocks = [];
        if (tick_number % extra_data.max_ticks == 0) {
            
        }
        return updated_blocks;
    }

}