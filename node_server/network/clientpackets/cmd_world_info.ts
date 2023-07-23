import { ServerClient } from "@client/server_client.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_WORLD_INFO;
    }

    static async read(player, packet) {

        const world = player.world
        if (packet?.data) {
            world.info.public = packet.data?.public ? 1 : 0
            world.game.db.setWorldPublic(world.info.user_id, world.info.gid, world.info.public)
        }
        
        player.world.sendSelected({
            name:ServerClient.CMD_WORLD_INFO, 
            data: world.getInfo()
        }, player)
        console.log('send')
        return true
    
    }

}