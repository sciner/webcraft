import {ServerClient} from "../../www/js/server_client.js";
import {Vector} from "../../www/js/helpers.js";

const reg = /[^a-z0-9\s]/gi;

export default class TeleportPlugin {
    
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
    
    chTitle(title){
        return (!title.match(reg) && title.length < 50);
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