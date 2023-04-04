import { ServerClient } from "@client/server_client.js";
import type { ServerPlayer } from "server_player.js";

export default class packet_reader {

    static queue = true
    static command = ServerClient.CMD_QUEUED_PING

    static async read(player: ServerPlayer, packet: INetworkMessage<number>) {
        player.sendPackets([{
            name: ServerClient.CMD_QUEUED_PING,
            data: packet.data,
        }])
        return true
    }

}