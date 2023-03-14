import {ServerClient} from "@client/server_client.js";
import type {ServerPlayer} from "../../server_player.js";
import type {PlayerControlSessionPacket} from "@client/control/player_control_packets.js";

export default class packet_reader {

    static command = ServerClient.CMD_PLAYER_CONTROL_SESSION
    static queue = true
    static terminateOnException = true

    static async read(player: ServerPlayer, packet: INetworkMessage<PlayerControlSessionPacket>) {
        player.controlManager.onClientSession(packet.data)
        return true
    }

}