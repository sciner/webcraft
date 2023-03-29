import { ServerClient } from "@client/server_client.js";
import { DEFAULT_MOB_TEXTURE_NAME, MOB_TYPE } from "@client/constant.js";
import { MobSpawnParams } from "mob.js";
import { Vector } from "@client/helpers.js";
import type { ServerPlayer } from "server_player";

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
    static async read(player : ServerPlayer, packet) {
        const item = player.inventory.items[player.inventory.current.index]
        if (!item) {
            return true
        }
        const bm = player.world.block_manager
        if (item.id == bm.SNOWBALL.id) {
            // смещение, что бы себя не бить
            const rotate = new Vector(Math.sin(player.state.rotate.z), Math.sin(player.state.rotate.x), Math.cos(player.state.rotate.z))
            const pos = player.getEyePos().add(rotate.mulScalar(1))
            const params = new MobSpawnParams(
                pos,
                player.state.rotate,
                {
                    model_name: MOB_TYPE.SNOWBALL,
                    texture_name: DEFAULT_MOB_TEXTURE_NAME
                }
            )
            const snowball = player.world.mobs.spawn(player, params)
            player.inventory.decrement()
            return true
        }

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