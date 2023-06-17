import { ServerClient } from "@client/server_client.js";
import { getPlayerFiles } from "../../server_helpers.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_MEDIA_FILES;
    }

    static async read(player, packet) {
        const id = player.session.user_id
        if (packet?.delete && (packet.delete.indexOf('/') == -1)) {
            const small = packet.delete
            const big = packet.delete.replace('_', '')
            fs.unlinkSync(`../www/upload/${id}/${small}`)
            fs.unlinkSync(`../www/upload/${id}/${big}`)
        }
        const files = await getPlayerFiles(id)
        const packets = [{
            name: ServerClient.CMD_MEDIA_FILES,
            data: {
                'files': files
            }
        }];

        player.world.sendSelected(packets, player)

        return true
    
    }

}