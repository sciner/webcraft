import { ServerClient } from '../../../www/js/server_client.js';

export default class packet_reader {
    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_INVENTORY_NEW_STATE;
    }

    // Apply new inventory state
    static async read(player, packet) {
        player.inventory.newState(packet.data);
        return true;
    }
}
