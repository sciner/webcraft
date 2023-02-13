import { ServerClient } from '../../../www/js/server_client.js';

export default class packet_reader {
    // must be put to queue
    static get queue() {
        return false;
    }

    // ping from player
    static get command() {
        return ServerClient.CMD_PING;
    }

    // Ping from player
    static async read(player, packet) {
        // do nothing
        return true;
    }
}
