import { Vector } from "@client/helpers.js";
import type { ServerPlayer } from "server_player";

export default class Chat_SetWorldSpawn {

    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    onChat(chat) {
        chat.onCmd(async (player : ServerPlayer, cmd, args) => {
            switch(cmd) {
                case '/setworldspawn': {
                    const world = player.world;
                    world.throwIfNotWorldAdmin(player)
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