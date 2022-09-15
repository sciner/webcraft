import { ServerClient } from "../../../www/js/server_client.js";

import { CMD_ENTITY_INDICATORS } from "../serverpackets/cmd_entity_indicators.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_RESURRECTION;
    }

    static async read(player, packet) {
        const ind_def = player.world.getDefaultPlayerIndicators();
        player.live_level = ind_def.live.value;
        player.oxygen_level = ind_def.oxygen.value;
        player.food_level = ind_def.food.value;
        player.is_dead = false;
        player.teleport({
            place_id: 'spawn',
        });
        return true;
    }

}