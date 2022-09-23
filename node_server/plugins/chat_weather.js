import { Weather } from "../../www/js/type.js";

/**
 * @type Weather[]
 */
const LEGAL_WEATHERS = [
    new Weather('rain', 'Установлена дождливая погода'),
    new Weather('snow', 'Установлена снежная погода'),
    new Weather('clear', 'Установлена ясная погода'),
];

export default class Chat_Weather {

    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    onChat(chat) {
        chat.onCmd(async (player, cmd, args) => {
            console.log(cmd);
            switch(cmd) {
                case '/weather': {
                    const world = player.world;
                    // if(!world.admins.checkIsAdmin(player)) {
                    //     throw 'error_not_permitted';
                    // }
                    args = chat.parseCMD(args, ['string', 'string']);
                    if(args.length == 2) {
                        const name = args[1].trim().toLowerCase();
                        for(let weather of LEGAL_WEATHERS) {
                            if(weather.name == name) {
                                world.setWeather(weather.name);
                                world.chat.sendSystemChatMessageToSelectedPlayers(weather.message, [player.session.user_id]);    
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