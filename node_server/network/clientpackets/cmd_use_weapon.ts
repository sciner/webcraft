import { ServerClient } from "@client/server_client.js";
import type { ServerPlayer } from "server_player";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // ping from player
    static get command() {
        return ServerClient.CMD_USE_WEAPON
    }

    // use item
    static async read(player: ServerPlayer, packet) {
        const target = packet.data.target
        player.combat.Attack(target.mid, target.pid)
        return true
    }

}