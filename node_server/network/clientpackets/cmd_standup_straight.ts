import { ServerClient } from "@client/server_client.js";

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
    static async read(player, packet) {
        if (player.findFreePosition()) {
            player.state.sitting = false
            player.state.sleep = false
            player.sendNearPlayers()
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
            player.world.sendSelected(packets_for_player, player)
        }
        return true
    }

}