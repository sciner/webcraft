import { ServerClient } from "@client/server_client.js";
import type { ServerPlayer } from "server_player";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_CHANGE_RENDER_DIST;
    }

    // 
    static async read(player : ServerPlayer, packet) {
        player.changeRenderDist(parseInt(packet.data));
        return true;
    }

}