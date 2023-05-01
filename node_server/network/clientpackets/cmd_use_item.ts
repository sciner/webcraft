import { ServerClient } from "@client/server_client.js";
import { DEFAULT_MOB_TEXTURE_NAME } from "@client/constant.js";
import { MobSpawnParams } from "mob.js";
import { Vector } from "@client/helpers.js";

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
        if (item.id == bm.SNOWBALL.id) {
            // смещение, что бы себя не бить
            const rotate = new Vector(Math.sin(player.state.rotate.z), 0, Math.cos(player.state.rotate.z))
            const pos = player.getEyePos().add(rotate)
            const params = new MobSpawnParams(
                pos,
                player.state.rotate,
                {
                    model_name: "mob/snowball",
                    texture_name: DEFAULT_MOB_TEXTURE_NAME
                }
            )
            const snowball = player.world.mobs.spawn(player, params)
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