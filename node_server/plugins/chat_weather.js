import { Weather } from '../../www/js/block_type/weather.js';

export default class Chat_Weather {
    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    onChat(chat) {
        chat.onCmd(async (player, cmd, args) => {
            switch (cmd) {
                case '/weather': {
                    const world = player.world;
                    // if(!world.admins.checkIsAdmin(player)) {
                    //     throw 'error_not_permitted';
                    // }
                    args = chat.parseCMD(args, ['string', 'string']);
                    if (args.length == 2) {
                        const name = args[1].trim().toLowerCase();
                        var id = Weather.BY_NAME[name] || Weather.CLEAR;
                        world.setWeather(id);
                        world.chat.sendSystemChatMessageToSelectedPlayers(
                            'weather_is_set|weather_' + Weather.NAMES[id],
                            [player.session.user_id],
                        );
                        return true;
                    }
                    break;
                }
            }
            return false;
        });
    }
}
