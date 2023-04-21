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
        let pos = getValidPosition(new Vector(player.state.pos).floored(), player.world)
        if (player.driving) {
            player.state.pos = pos ?? player.state.pos // разрешить прервать езду даже если не нашлась безопасная позиции
            player.driving.onStandUp(player, packet.data)
            return true
        }
        if (pos) {
            player.state.pos = pos
            player.state.sitting = false
            player.state.sleep = false
            const packets_for_player = [
                {
                    name: ServerClient.CMD_PLAY_SOUND,
                    data: {tag: 'madcraft:block.cloth', action: 'hit'}
                },
                {
                    name: ServerClient.CMD_STANDUP_STRAIGHT,
                    data: null
                }
            ]
            player.sendPackets(packets_for_player)
        }
        return true
    }

}