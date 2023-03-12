import {InPacketBuffer, PacketBuffer} from "@client/packet_compressor.js";
import { ServerClient } from "@client/server_client.js";
import type {ServerPlayer} from "../../server_player.js";

export default class packet_reader {

    private static inPacketBuffer = new InPacketBuffer()

    static terminateOnException = true

    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_PLAYER_STATE;
    }

    //
    static async read(player: ServerPlayer, packet: INetworkMessage<PacketBuffer>) {
        const data = packet.data

        /* Reading ping_value.
        See also commented client code that writes ping_value in Player.sendState()

        const ping_value = data.pop()
        */

        const inPacketBuffer = this.inPacketBuffer.import(data)
        player.controlManager.onClientTicks(inPacketBuffer)
        return true;
    }

}