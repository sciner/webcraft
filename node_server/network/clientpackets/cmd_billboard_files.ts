import { DEMO_PATH } from "@client/constant.js";
import { BLOCK_ACTION, ServerClient } from "@client/server_client.js";
import { WorldAction } from "@client/world_action.js";
import Billboard from "player/billboard.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_BILLBOARD_MEDIA;
    }

    static async read(player, packet) {
        const id = player.session.user_id
        if (packet?.delete && !packet.delete.demo) {
            const small = player.world.getPlayerFile(id, packet.delete.file, false)
            const big = small.replace('_', '')
            fs.unlinkSync(small)
            fs.unlinkSync(big)
            // @todo не забыть удалить этот кусок после написания кода по установки на все банеры дефолта
            const world = player.world
            const block = world.getBlock(packet.pos)
            const is_small = (block.id == world.block_manager.BILLBOARD1X2.id)
            if (block?.extra_data?.texture?.url == big) {
                const actions = new WorldAction(null, this, false, false)
                actions.addBlocks([{pos: block.posworld, item: {
                    id: block.id,
                    rotate: block.rotate, 
                    extra_data : {
                        relindex: -1,
                        texture: { 
                            url: DEMO_PATH + (is_small ? 'rollup1.png' :  'ban001.png' )
                        }    
                    }
                }, action_id: BLOCK_ACTION.MODIFY}]);
                world.actions_queue.add(player, actions);
            } 
        }
        const files = await Billboard.getPlayerFiles(id)
        const packets = [{
            name: ServerClient.CMD_BILLBOARD_MEDIA,
            data: {
                'files': files
            }
        }];

        player.world.sendSelected(packets, player)

        return true
    
    }

}