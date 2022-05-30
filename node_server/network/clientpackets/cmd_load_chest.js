import { ServerClient } from "../../../www/js/server_client.js";

export default class packet_reader {

    // must be puto to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_LOAD_CHEST;
    }

    // Request chest content
    static async read(player, packet) {
        player.world.chest_load_queue.add(player, packet.data);
    }

}