import { Vector } from "@client/helpers.js";

export default class Chat_SetWorldSpawn {

    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    onChat(chat) {
        chat.onCmd(async (player, cmd, args) => {
            switch(cmd) {
                case '/setworldspawn': {
                    const world = player.world;
                    if(!world.admins.checkIsAdmin(player)) {
                        throw 'error_not_permitted';
                    }
                    args = chat.parseCMD(args, ['string', 'int', 'int', 'int']);
                    if(args.length == 4) {
                        const x = parseFloat(args[1]);
                        const y = parseFloat(args[2]);
                        const z = parseFloat(args[3]);
                        const pos = new Vector(x, y, z);
                        await world.setWorldSpawn(pos);
                        world.chat.sendSystemChatMessageToSelectedPlayers(`world_spawn_point_changed_to|${pos.toHash()}`, [player.session.user_id]);    
                        return true;
                    }
                    break;
                }
            }
            return false;
        });
    }

}