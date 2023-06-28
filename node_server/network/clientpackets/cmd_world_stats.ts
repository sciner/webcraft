import { ServerClient } from "@client/server_client.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_WORLD_STATS;
    }

    static async read(player, packet) {

        const world   = player.world
        const info    = world.info
        const creater = world.players.get(info.user_id)

        const packets = [{
            name: ServerClient.CMD_WORLD_STATS,
            data: {
                "title": info.title,
                "username": creater.session.username,
            }
        }];

        player.world.sendSelected(packets, player)

        return true
    }

}