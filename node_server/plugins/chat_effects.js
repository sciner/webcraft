import { ServerClient } from "../../www/js/server_client.js";
import { Vector } from "../../www/js/helpers.js";
import { Effect } from "../../www/js/block_type/effect.js";

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
                args = chat.parseCMD(args, ['string', 'string', 'int', 'int', 'int']);
                const action = args[1];
                const id = args[2] || -1;
                const level = args[3] || 0;
                const time = args[4] || 0;
                const effect = Effect.get()[id];
                if (action == 'give') {
                    if (!effect) {
                        this.sendMessage("Эффект с id: " + id + " не найден. Пример /effect give [id] [level] [time]", player);
                        return false;
                    }
                    if (level < 1) {
                        this.sendMessage("уровень эффекта < 0. Пример /effect give " + id + " [level] [time]", player);
                        return false;  
                    }
                    if (time < 1) {
                        this.sendMessage("время эффекта < 0. Пример /effect give " + id + " " + level + " [time]", player);
                        return false;  
                    }
                    player.effects.addEffects([{id: id, level: level, time: time}]);
                    this.sendMessage("Эффект " + effect.title + " добавлен на " + time + " сек.", player);
                } else if (action == 'clear') {
                    if (!effect && id != -1) {
                        this.sendMessage("Эффект с id: " + id + " не найден. Пример /effect give [id] [level] [time]", player);
                        return false;
                    }
                    player.effects.delEffects(id);
                    if (id == -1) {
                        this.sendMessage("Все эффекты удалены", player);
                    } else {
                        chat.sendSystemChatMessageToSelectedPlayers(`effect_removed|${effect.title}`, [player.session.user_id]);   
                    }
                }
                return true;
            }
            return false;
        });
    }
}