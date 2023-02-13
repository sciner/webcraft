import { Effect } from '../../www/js/block_type/effect.js';

export default class EffectsPlugin {
    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    onChat(chat) {
        chat.onCmd(async (player, cmd, args) => {
            if (cmd == '/effect') {
                args = chat.parseCMD(args, [
                    'string',
                    'string',
                    'int',
                    'int',
                    'int',
                ]);
                const action = args[1];
                const id = args[2] || -1;
                const level = args[3] || 0;
                const time = args[4] || 0;
                const effect = Effect.get()[id];
                if (action == 'give') {
                    if (!effect) {
                        chat.sendSystemChatMessageToSelectedPlayers(
                            `effect_not_found|${effect.title}`,
                            [player.session.user_id],
                        );
                        return false;
                    }
                    if (level < 1) {
                        chat.sendSystemChatMessageToSelectedPlayers(
                            `effect_error_level`,
                            [player.session.user_id],
                        );
                        return false;
                    }
                    if (time < 1) {
                        chat.sendSystemChatMessageToSelectedPlayers(
                            `effect_error_time`,
                            [player.session.user_id],
                        );
                        return false;
                    }
                    player.effects.addEffects([
                        { id: id, level: level, time: time },
                    ]);
                    chat.sendSystemChatMessageToSelectedPlayers(
                        `effect_add_ok|${effect.title}|${time}`,
                        [player.session.user_id],
                    );
                } else if (action == 'clear') {
                    if (!effect && id != -1) {
                        chat.sendSystemChatMessageToSelectedPlayers(
                            `effect_not_found|${effect.title}`,
                            [player.session.user_id],
                        );
                        return false;
                    }
                    player.effects.delEffects(id);
                    if (id == -1) {
                        chat.sendSystemChatMessageToSelectedPlayers(
                            `effect_all_removed`,
                            [player.session.user_id],
                        );
                    } else {
                        chat.sendSystemChatMessageToSelectedPlayers(
                            `effect_removed|${effect.title}`,
                            [player.session.user_id],
                        );
                    }
                }
                return true;
            }
            return false;
        });
    }
}
