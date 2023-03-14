import type {PacketBuffer} from "@client/packet_compressor.js";
import { ServerClient } from "@client/server_client.js";
import type {ServerPlayer} from "../../server_player.js";

export default class packet_reader {

    static terminateOnException = true

    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_PLAYER_CONTROL_UPDATE;
    }

    //
    static async read(player: ServerPlayer, packet: INetworkMessage<PacketBuffer>) {
        player.controlManager.onClientTicks(packet.data)
        return true;
    }

}