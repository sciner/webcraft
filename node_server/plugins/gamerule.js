export default class Chat_Gamerule {

    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    onChat(chat) {
        chat.onCmd(async (player, cmd, args) => {
            switch(cmd) {
                case '/gamerule': {
                    const world = player.world;
                    if(!world.admins.checkIsAdmin(player)) {
                        throw 'error_not_permitted';
                    }
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