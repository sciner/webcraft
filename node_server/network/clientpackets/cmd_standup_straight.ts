import { getValidPosition, Vector } from "@client/helpers.js";
import { ServerClient } from "@client/server_client.js";
import type {ServerPlayer} from "../../server_player.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_STANDUP_STRAIGHT;
    }

    //
    static async read(player: ServerPlayer, packet: INetworkMessage<int | null>) {
        player.controlManager.syncWithEventId(packet.data)
        let pos = getValidPosition(new Vector(player.state.pos).floored(), player.world)
        if (player.driving) {
            player.state.pos = pos ?? player.state.pos // разрешить прервать езду даже если не нашлась безопасная позиции
            player.driving.onStandUp(player)
            return true
        }
        if (pos) {
            player.state.pos = pos
            player.standUp()
        }
        return true
    }

}