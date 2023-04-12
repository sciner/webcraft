import type {ServerChat} from "../server_chat.js";
import type {ServerPlayer} from "../server_player.js";

export default class Chat_Gamerule {

    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    onChat(chat: ServerChat) {
        chat.onCmd(async (player: ServerPlayer, cmd: string, args: string[]) => {
            switch(cmd) {
                case '/gamerule': {
                    const world = player.world;
                    chat.checkIsAdmin(player)
                    //
                    args = chat.parseCMD(args, ['string', 'string', 'string']);
                    if(args.length > 1) {
                        const rule_code = args[1].trim();
                        if(args.length == 3) {
                            await world.rules.setValue(rule_code, args[2]);
                            return true;
                        } else if(args.length == 2) {
                            const value = world.rules.getValue(rule_code);
                            world.chat.sendSystemChatMessageToSelectedPlayers(`Gamerule ${rule_code} is currently set to: ${value}`, player);
                            return true;
                        }
                    } else {
                        world.chat.sendSystemChatMessageToSelectedPlayers(world.rules.getTable(), player, true);
                        return true;
                    }
                    break;
                }
            }
            return false;
        });
    }

}