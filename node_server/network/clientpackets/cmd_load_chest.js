import { Vector } from "../../../www/js/helpers.js";
import { ServerClient } from "../../../www/js/server_client.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_LOAD_CHEST;
    }

    // Request chest content
    static async read(player, packet) {
        if(!player.game_mode.canBlockAction()) {
            return true;
        }
        //
        const pos = new Vector(packet.data.pos);
        const chest = await player.world.chests.get(pos);
        if(chest) {
            if (chest.id < 0) {
                // if chest not loaded
                if (!packet.attempts_count) {
                    packet.attempts_count = 0;
                }
                if (++packet.attempts_count < 1000) {
                    return false;
                }
            } else {
                player.world.chests.sendContentToPlayers([player], pos);
                return true;
            }
        }
        throw `Chest ${pos.toHash()} not found`;
    }

}