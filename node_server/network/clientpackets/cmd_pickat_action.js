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
        const packetData = packet.data
        if (packetData.interactMobID || packetData.interactPlayerID) {
            player.onAttackEntity(packetData.button_id, packetData.interactMobID, packetData.interactPlayerID);
        } else {
            const correct_destroy = player.isMiningComplete(packetData);
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
            const actions = await doBlockAction(packetData, world, player_info, currentInventoryItem);
            // проверям скорость, если ошибка, то ворачиваем как было
            if (!correct_destroy) {
                for (const block of actions.blocks.list) {
                    // TODO: extra_data надо восстанавлиать
                    // TODO: тут точно нет доверия данным от игрока?
                    block.item.id = block.destroy_block.id;
                }
            }
            // compare two actions
            if (packetData.actions?.blocks?.list) {
                const player_json = JSON.stringify(packetData.actions.blocks.list);
                const server_json = JSON.stringify(actions.blocks.list);
                const same_results = player_json == server_json;
                if(!same_results || !correct_destroy) {
                    // собрать патч, для мира игрока:
                    const patch_blocks = new VectorCollector();
                    // 1. вложить в патч реальные блоки на указанных игроком позициях изменённых блоков
                    // А если чанк не загружен - то присланные игроком блоки (не важно правильны ли они - они не попадают на сервер)
                    for(const item of packetData.actions.blocks.list) {
                        if ('pos' in item) {
                            const pos = new Vector(item.pos);
                            if(pos.distance(player.state.pos) < 64) {
                                const tblock = world.getBlock(pos);
                                if(tblock && tblock.id >= 0) {
                                    const patch = tblock.convertToDBItem();
                                    patch_blocks.set(pos, patch);
                                } else if (pos.equal(packetData.pos) && packetData.pos.block) {
                                    // a block from RaycasterResult - the one that was destroyed
                                    patch_blocks.set(pos, packetData.pos.block);
                                }
                            }
                        }
                    }
                    // 2. пропатчить этот массив текущим серверным изменением
                    for (const item of actions.blocks.list) {
                        patch_blocks.set(item.pos, item.item);
                    }
                    // 3. Make patch commands
                    const packets = [];
                    for (const [pos, item] of patch_blocks.entries()) {
                        packets.push({
                            name: ServerClient.CMD_BLOCK_SET,
                            data: {
                                action_id: ServerClient.BLOCK_ACTION_CREATE,
                                pos,
                                item
                            }
                        });
                    }
                    world.sendSelected(packets, player);
                    console.error(`player patch blocks '${player.session.username}'`);
                }
            }
            if (correct_destroy) {
                world.actions_queue.add(player, actions);
            }
        }
        return true;
    }

}