import { ServerClient } from "../../../www/js/server_client.js";
import { doBlockAction } from "../../../www/js/world_action.js";
import { Vector, VectorCollector } from "../../../www/js/helpers.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_PICKAT_ACTION;
    }

    // Pickat action
    static async read(player, packet) {
        if(!player.game_mode.canBlockAction()) {
            return true;
        }
        //
        const world = player.world;
        const currentInventoryItem = player.inventory.current_item;
        if(player.state.sitting || player.state.lies) {
            return true;
        }
        if (packet.data.interractMobID) {
            const mob = world.mobs.get(packet.data.interractMobID);
            if (mob) {
                mob.punch(player, packet.data);
            }
        } else {
            const player_info = {
                radius:     0.7,
                height:     player.height,
                username:   player.session.username,
                pos:        new Vector(player.state.pos),
                rotate:     player.rotateDegree.clone(),
                session:    {
                    user_id: player.session.user_id
                }
            };
            const actions = await doBlockAction(packet.data, world, player_info, currentInventoryItem);
            // compare two actions
            const player_json = JSON.stringify(packet.data.actions.blocks.list);
            const server_json = JSON.stringify(actions.blocks.list);
            const same_results = player_json == server_json;
            if(!same_results) {
                // собрать патч, для мира игрока:
                const patch_blocks = new VectorCollector();
                // 1. вложить в патчк реальные блоки на указанных игроком позициях изменённых юлоков
                for(let item of packet.data.actions.blocks.list) {
                    if('pos' in item) {
                        const pos = new Vector(item.pos);
                        if(pos.distance(player.state.pos) < 64) {
                            const tblock = world.getBlock(pos);
                            if(tblock && tblock.id >= 0) {
                                const patch = tblock.convertToDBItem();
                                patch_blocks.set(pos, patch);
                            }
                        }
                    }
                }
                // 2. пропатчить этот массив текущим серверным изменением
                for(let item of actions.blocks.list) {
                    patch_blocks.set(item.pos, item.item);
                }
                // 3. Make patch commands
                const packets = [];
                for(const [pos, item] of patch_blocks.entries()) {
                    packets.push({
                        name: ServerClient.CMD_BLOCK_SET,
                        data: {
                            action_id: ServerClient.BLOCK_ACTION_CREATE,
                            pos,
                            item
                        }
                    });
                }
                world.sendSelected(packets, [player.session.user_id], []);
                console.error(`player patch blocks '${player.session.username}'`);
            }
            world.actions_queue.add(player, actions);
        }
		if(packet.data.destroyBlock == true) {
			player.state.stats.pickat++;
		}
        return true;
    }

}