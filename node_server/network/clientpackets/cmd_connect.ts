import {ServerClient} from "@client/server_client.js";
import {SPECTATOR_BOTS_ENABLED} from "../../server_constant.js";
import type {ServerPlayer} from "../../server_player.js";
import type {CmdConnectData} from "@client/player.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_CONNECT;
    }

    // Player connect to world
    static async read(player: ServerPlayer, packet: INetworkMessage<CmdConnectData>) {
        let world_guid = packet.data.world_guid;
        // специальный ражим для бота - наблюдателя (если разрешено настройкой)
        if (packet.data.is_spectator_bot) {
            if (!SPECTATOR_BOTS_ENABLED) {
                throw '!SPECTATOR_BOTS_ENABLED'
            }
            player.is_spectator_bot = true
        }

        player.session = await Qubatch.db.GetPlayerSession(player.session_id);
        Log.append('CmdConnect', {world_guid, session: player.session});
        await player.world.onPlayer(player, player.skin);
        return true;
    }

}