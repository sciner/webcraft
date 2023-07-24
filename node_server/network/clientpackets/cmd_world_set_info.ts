import { ServerClient } from "@client/server_client.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_WORLD_SET_INFO;
    }

    static async read(player, packet) {
        const world = player.world
        if(!world.admins.checkIsAdmin(player)) {
            throw 'error_not_permitted'
        }
        if (packet?.data) {
            world.info.is_public = packet.data?.is_public ? 1 : 0
            world.game.db.setWorldPublic(world.info.user_id, world.info.gid, world.info.is_public)
            console.log('server is_public ' + packet.data?.is_public)
        }
        
        return true

    }

}