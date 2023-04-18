import { ServerClient } from "@client/server_client.js";

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
    static async read(player, packet) {
        const target = packet.data.target
        player.combat.onAttack(target.mid, target.pid)
        return true
    }

}