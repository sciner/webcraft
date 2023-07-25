import { ServerClient } from "@client/server_client.js";
import type { ServerPlayer } from "server_player";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_GAMEMODE_NEXT;
    }

    // Next game mode
    static async read(player : ServerPlayer, packet) : Promise<boolean> {
        player.world.throwIfNotWorldAdmin(player)
        player.game_mode.next();
        return true;
    }

}