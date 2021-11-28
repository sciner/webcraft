import {ServerClient} from "../www/js/server_client.js";

export class ServerChat {

    constructor(world) {
        this.world = world;
    }

    sendMessage(player, params) {
        // Command
        if (params.text.substring(0, 1) == '/') {
            try {
                this.runCmd(player, params.text)
            } catch(e) {
                let players = [player.session.user_id];
                this.sendSystemChatMessageToSelectedPlayers(e, players)
            }
            return;
        }
        // Simple message
        params.username = player.session.username
        let packets = [{
            name: ServerClient.CMD_CHAT_SEND_MESSAGE,
            data: params
        }];
        this.world.Db.insertChatMessage(player, params);
        this.world.sendAll(packets, [player.session.user_id]);
    }

    runCmd(player, text) {
        throw 'Commands are temporarily unsupported';
    }

    // sendSystemChatMessageToSelectedPlayers...
    sendSystemChatMessageToSelectedPlayers(text, selected_players) {
        let packets = [
            {
                name: ServerClient.CMD_CHAT_SEND_MESSAGE,
                data: {
                    username: '<MadCraft>',
                    text: text
                }
            }
        ];
        this.world.sendSelected(packets, selected_players, []);
    }

}