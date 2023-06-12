import { ServerClient } from "@client/server_client.js";

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
        const guid = player.session.user_guid
        const upload = await fs.promises.readdir(`../www/upload/${guid}/`)
        const demo = await fs.promises.readdir(`../www/media/demo/`)
        const files = []
        for (const file of demo) {
            files.push(`/media/demo/${file}`)
        }
        for (const file of upload) {
            files.push(`/upload/${guid}/${file}`)
        }
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