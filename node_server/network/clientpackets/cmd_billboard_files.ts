import { ServerClient } from "@client/server_client.js";
import Billboard from "player/billboard.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_BILLBOARD_MEDIA;
    }

    static async read(player, packet) {
        const id = player.session.user_id
        if (packet?.delete && !packet.delete.demo) {
            const small = player.world.getPlayerFile(id, packet.delete.file, false)
            const big = small.replace('_', '')
            fs.unlinkSync(small)
            fs.unlinkSync(big)
        }
        const files = await Billboard.getPlayerFiles(id)
        const packets = [{
            name: ServerClient.CMD_BILLBOARD_MEDIA,
            data: {
                'files': files
            }
        }];

        player.world.sendSelected(packets, player)

        return true
    
    }

}