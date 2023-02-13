export default class Chat_Ping {
    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    onChat(chat) {
        chat.onCmd(async (player, cmd, args) => {
            switch (cmd) {
                case '/ping': {
                    player.world.chat.sendSystemChatMessageToSelectedPlayers(
                        `pong`,
                        [player.session.user_id],
                    );
                    return true;
                }
            }
            return false;
        });
    }
}
