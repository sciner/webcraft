import { ServerClient } from '../../../www/js/server_client.js';

export default class packet_reader {
    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_GAMEMODE_NEXT;
    }

    // Next game mode
    static async read(player, packet) {
        if (!player.world.admins.checkIsAdmin(player)) {
            throw 'error_not_permitted';
        }
        player.game_mode.next();
        return true;
    }
}
