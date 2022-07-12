import { ServerClient } from "../../../www/js/server_client.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_DROP_ITEM;
    }

    // Drop item from hand
    static async read(player, packet) {
        if(!player.game_mode.canDropItems()) {
            return true;
        }
        const mobs = player.world.getMobsNear(player.state.pos, 100);
        console.log(mobs);
        // player.inventory.dropItem();
        return true;
    }

}