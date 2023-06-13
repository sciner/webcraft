import { getPlayerFiles } from "@client/helpers";
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
        const files = await getPlayerFiles(guid)
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