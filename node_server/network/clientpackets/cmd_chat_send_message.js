import { ServerClient } from '../../../www/js/server_client.js';

export default class packet_reader {
    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_CHAT_SEND_MESSAGE;
    }

    // Send message to chat
    static async read(player, packet) {
        player.world.chat.sendMessage(player, packet.data);
        return true;
    }
}
