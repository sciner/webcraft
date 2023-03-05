import type { ServerPlayer } from "server_player";

export default class Chat_ViewDistance {

    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    onChat(chat) {
        chat.onCmd(async (player : ServerPlayer, cmd, args) => {
            console.log(cmd);
            switch(cmd) {
                case '/vdist':
                case '/view-distance': {
                    args = chat.parseCMD(args, ['string', 'int']);
                    if(args.length == 2) {
                        player.changeRenderDist(parseInt(args[1]));
                        return true;
                    }
                    break;
                }
            }
            return false;
        });
    }

}