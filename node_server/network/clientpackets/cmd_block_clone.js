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
        if(!player.game_mode.canBlockClone()) {
            return true;
        }
        //
        const pos = new Vector(packet.data);
        const chunk_addr = getChunkAddr(pos);
        const chunk = player.world.chunks.get(chunk_addr);
        if(!chunk) {
            throw 'error_invalid_block_position';
        }
        const block = chunk.getBlock(pos);
        player.inventory.cloneMaterial(block.material, player.game_mode.getCurrent().block_clone);
        return true;
    }

}