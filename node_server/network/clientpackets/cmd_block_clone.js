import { getChunkAddr, Vector } from "../../../www/js/helpers.js";
import { ServerClient } from "../../../www/js/server_client.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_BLOCK_CLONE;
    }

    //
    static async read(player, packet) {
        player.inventory.cloneMaterial(new Vector(packet.data), true);
        return true;
    }

}