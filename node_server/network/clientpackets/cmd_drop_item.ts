import { ServerClient } from "@client/server_client.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_DROP_ITEM;
    }

    // Drop item from hand
    static async read(player, packet) {
        if(!player.game_mode.canDropItems()) {
            return true;
        }
        player.inventory.dropCurrentItem();
        return true;
    }

}