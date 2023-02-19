import { ServerClient } from "../../../www/src/server_client.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_CHEST_CONFIRM;
    }

    // 
    static async read(player, packet) {
        if(!player.game_mode.canBlockAction()) {
            return true;
        }
        await player.world.chests.confirmPlayerAction(player, packet.data);
        return true;
    }

}