import { ServerClient } from "@client/server_client.js";

const DEMO_PATH = `../www/media/demo/`

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
        const demo = await fs.promises.readdir(DEMO_PATH)
        const files = []
        for (const file of demo) {
            files.push(`/media/demo/${file}`)
        }
        const path = `../www/upload/${guid}/`
        if (fs.existsSync(path)) {
            const upload = await fs.promises.readdir(path)
            for (const file of upload) {
                files.push(path + file)
            }
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