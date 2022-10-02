import { Weather } from "../../www/js/block_type/weather.js";

export default class Chat_Weather {

    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    onChat(chat) {
        chat.onCmd(async (player, cmd, args) => {
            switch(cmd) {
                case '/weather': {
                    const world = player.world;
                    // if(!world.admins.checkIsAdmin(player)) {
                    //     throw 'error_not_permitted';
                    // }
                    args = chat.parseCMD(args, ['string', 'string']);
                    if(args.length == 2) {
                        const name = args[1].trim().toLowerCase();
                        switch (name) {
                            case 'rain': {
                                world.setWeather(Weather.RAIN);
                                world.chat.sendSystemChatMessageToSelectedPlayers('Установлена дождливая погода', [player.session.user_id]);
                                break;
                            }
                            case 'snow': {
                                world.setWeather(Weather.SNOW);
                                world.chat.sendSystemChatMessageToSelectedPlayers('Установлена снежная погода', [player.session.user_id]);
                                break;
                            }
                            default: {
                                world.setWeather(Weather.CLEAR);
                                world.chat.sendSystemChatMessageToSelectedPlayers('Установлена ясная погода', [player.session.user_id]);
                            }
                        }
                        return true;
                    }
                    break;
                }
            }
            return false;
        });
    }

}