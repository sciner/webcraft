import { ServerClient } from '../../../www/js/server_client.js';

export default class packet_reader {
    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_INVENTORY_SELECT;
    }

    //
    static async read(player, packet) {
        player.inventory.setIndexes(packet.data, false);
        return true;
    }
}
