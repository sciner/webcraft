import { ServerClient } from "@client/server_client.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_MODIFY_INDICATOR_REQUEST;
    }

    /**
     * @param {ServerPlayer} player 
     * @param {*} packet 
     * @returns 
     */
    static async read(player, packet) {
        switch(packet.data.indicator) {
            case 'live': {
                const value = packet.data.value;
                if(value >= 0) {
                    throw 'error_invalid_indicator_value';
                }
                const comment = packet.data.comment;
                player.setDamage(-value, comment);
            }
        }
        return true;
    }

}