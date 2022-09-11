import {ServerClient} from "../../www/js/server_client.js";
import {Vector} from "../../www/js/helpers.js";

export default class EffectsPlugin {
    
    static targets = ['chat'];
    
    onGame(game) {}

    onWorld(world) {}
    
    sendMessage(text, player) {
        let packets = [
            {
                name: ServerClient.CMD_CHAT_SEND_MESSAGE,
                data: {
                    username: '<MadCraft>',
                    text: text
                }
            }
        ];
        player.sendPackets(packets, [player], []);
    }

    onChat(chat) {
        chat.onCmd(async (player, cmd, args) => {
            if (cmd == '/effect') {
                args = chat.parseCMD(args, ['string', 'int', 'int', 'int']);
                const id = args[1];
                const level = args[2];
                const time = args[3];
                player.addEffects([{id: id, level: level, time: time}]);
                return true;
            }
            return false;
        });
    }
}