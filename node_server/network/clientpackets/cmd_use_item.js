import { ServerClient } from '../../../www/js/server_client.js';

const TIME_CAST = 28;

export default class packet_reader {
    // must be put to queue
    static get queue() {
        return false;
    }

    // ping from player
    static get command() {
        return ServerClient.CMD_USE_ITEM;
    }

    // use item
    static async read(player, packet) {
        if (packet?.data?.cancel) {
            player.cast.id = -1;
            player.cast.time = 0;
            return false;
        }
        const item = player.inventory.items[player.inventory.current.index];
        if (item && item.count > 0 && player.cast.time == 0) {
            player.cast.id = item.id;
            player.cast.time = TIME_CAST;
        }
        return true;
    }
}
