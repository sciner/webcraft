import { Vector } from '../../../www/js/helpers.js';
import { ServerClient } from '../../../www/js/server_client.js';

export default class packet_reader {
    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_CHUNK_LOAD;
    }

    // Пользователь подгрузил чанк
    static async read(player, packet) {
        const addr = new Vector(packet.data.pos);
        if (player.vision.nearbyChunks.has(addr)) {
            player.world.loadChunkForPlayer(player, addr);
        }
        return true;
    }
}
