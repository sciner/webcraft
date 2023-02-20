import { ServerClient } from "../../../www/src/server_client.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_SYNC_TIME;
    }

    static async read(player, packet) {

        player.sendPackets([{
            name: ServerClient.CMD_SYNC_TIME,
            data: { clientTime: packet.data.clientTime },
        }]);

        if (player.state) {
            player.state.stats.time += 5;
        }
        
        player.sendPackets([{
            name: ServerClient.CMD_SYNC_TIME,
            data: { clientTime: packet.data.clientTime },
        }]);

        return true;
    }

}