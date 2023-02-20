import { decompressPlayerStateC } from "../../../www/src/packet_compressor.js";
import { ServerClient } from "../../../www/src/server_client.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_PLAYER_STATE;
    }

    // 
    static async read(player, packet) {
        if(player.wait_portal) {
            return true;
        }
        const data = decompressPlayerStateC(packet.data);
        if(player.state.sitting || player.state.lies) {
            data.pos = player.state.pos.clone();
            // data.rotate = player.state.rotate.clone();
        }
        player.changePosition(data);
        //
        const distance = Math.sqrt(Math.pow(data.pos.x, 2) + Math.pow(data.pos.y, 2) + Math.pow(data.pos.z, 2));
        if ((parseFloat(distance.toFixed(1)) % 1) == 0) {
            player.state.stats.distance++;
            player.addExhaustion(0.01);
        }
        return true;
    }

}