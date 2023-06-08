import { PLAYER_STATUS } from "@client/constant.js";
import { ServerClient } from "@client/server_client.js";
import type { ServerPlayer } from "../../server_player.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_RESURRECTION;
    }

    static async read(player: ServerPlayer, packet) {
        const ind_def = player.world.defaultPlayerIndicators;
        player.live_level = ind_def.live;
        player.oxygen_level = ind_def.oxygen;
        player.food_level = ind_def.food;
        player.status = PLAYER_STATUS.WAITING_DATA;
        player.sendPackets([{name: ServerClient.CMD_SET_STATUS_WAITING_DATA, data: {}}]);
        player.teleport({
            place_id: 'spawn',
            safe: true
        });
        return true;
    }

}