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
        player.state.indicators.live.value = 20;
        player.is_dead = false;
        new CMD_ENTITY_INDICATORS(player);
        player.teleport({
            place_id: 'spawn',
        });
        return true;
    }

}