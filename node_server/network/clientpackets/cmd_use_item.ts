import { ServerClient } from "@client/server_client.js";

const TIME_CAST = 28;

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // ping from player
    static get command() {
        return ServerClient.CMD_USE_ITEM;
    }

    // use item
    static async read(player, packet) {
        const item = player.inventory.items[player.inventory.current.index]
        if (!item) {
            return true
        }
        const bm = player.world.block_manager
        if (item.id == bm.FISHING_ROD.id) {
            if (!player.fishing) {
                const params = {
                    type: "hook",
                    skin: "base",
                    pos: player.getEyePos(),
                    pos_spawn: player.getEyePos(),
                    rotate: player.state.rotate
                }
                player.fishing = player.world.mobs.create(params)
                player.fishing.parent = player // @todo мб лучше передавать id
            } else {
                player.fishing.getBrain().onFishing()
                player.fishing = null 
            }
            return true
        }
        if (packet?.data?.cancel) {
            player.cast.id = -1;
            player.cast.time = 0;
            return false;
        }
        if (item && item.count > 0 && player.cast.time == 0) {
            player.cast.id = item.id;
            player.cast.time = TIME_CAST;
        }
        return true;
    }

}