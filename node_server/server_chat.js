import {ServerClient} from "../www/js/server_client.js";

export class ServerChat {

    constructor(world) {
        this.world = world;
    }

    sendMessage(player, params) {
        // Command
        if (params.text.substring(0, 1) == '/') {
            try {
                return this.runCmd(params.text)
            } catch(e) {
                let players = [player.session.session_id];
                this.sendSystemChatMessageToSelectedPlayers(e, players)
            }
        }
        // Simple message
        params.username = player.session.username
        let packets = {
            name: ServerClient.CMD_CHAT_SEND_MESSAGE,
            data: params
        }
        this.world.Db.insertChatMessage(player, params);
        this.world.sendAll(packets, [player.session.session_id]);
    }

}