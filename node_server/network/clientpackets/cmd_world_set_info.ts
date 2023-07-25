import { SERVER_WORLD_WORKER_MESSAGE } from "@client/constant.js";
import { ServerClient } from "@client/server_client.js";
import type { ServerPlayer } from "server_player";
import type { ServerWorld } from "server_world";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_WORLD_SET_INFO;
    }

    static async read(player: ServerPlayer, packet) {
        const world = player.world as ServerWorld
        if(!player.isWorldAdmin()) {
            throw 'error_not_permitted'
        }
        if (packet?.data) {
            world.info.is_public = packet.data?.is_public ? 1 : 0
            const is_public = world.info.is_public
            const world_guid = world.info.guid
            const user_id = world.info.user_id
            world.worker_world.postMessage([SERVER_WORLD_WORKER_MESSAGE.change_world_is_public, {user_id, world_guid, is_public}])
        }
        return true
    }

}