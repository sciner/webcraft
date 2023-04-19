import { ServerClient } from "@client/server_client.js";
import type { ServerPlayer } from "server_player";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // ping from player
    static get command() {
        return ServerClient.CMD_PLAY_ANIM
    }

    // use item
    static async read(player: ServerPlayer, packet) {
        const title = packet.data.title
        const speed = packet.data.speed
        const time = packet.data.time
        player.setAnimation(title, speed, time)
        return true
    }

}