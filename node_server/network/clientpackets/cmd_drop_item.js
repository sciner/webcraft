import { ServerClient } from "../../../www/js/server_client.js";

export default class packet_reader {

    // must be puto to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_DROP_ITEM;
    }

    // Drop item from hand
    static async read(player, packet) {
        player.inventory.dropItem(packet.data);
        return true;
    }

}