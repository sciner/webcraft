import { ServerClient } from "@client/server_client.js";
import { ActionPlayerInfo, doBlockAction } from "@client/world_action.js";
import { Vector, VectorCollector } from "@client/helpers.js";
import { MOUSE } from "@client/constant.js";
import { TBlock } from "@client/typed_blocks3.js";
import type { ServerPlayer } from "../../server_player.js";
import type { ServerChunk } from "../../server_chunk.js";
import type {ICmdPickatData} from "@client/pickat.js";

const tmpBlock = new TBlock()

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
    static async read(player: ServerPlayer, packet: INetworkMessage<ICmdPickatData>) {
        if(!player.game_mode.canBlockAction()) {
            return true;
        }
        //
        const world = player.world;
        const currentInventoryItem = player.inventory.current_item;
        if(player.state.sitting || player.state.lies || player.state.sleep) {
            return true;
        }
        if (packet.data.interactMobID || packet.data.interactPlayerID) {
            if (packet.data.button_id == MOUSE.BUTTON_LEFT) {
                player.onAttackEntity(packet.data.interactMobID, packet.data.interactPlayerID)
            }
            if (packet.data.button_id == MOUSE.BUTTON_RIGHT) {
                player.onUseItem(packet.data.interactMobID, packet.data.interactPlayerID)
            }
        } else {
            const correct_destroy = player.isMiningComplete(packet.data);
            const player_info: ActionPlayerInfo = {
                radius:     0.7,
                height:     player.height,
                username:   player.session.username,
                pos:        new Vector(player.state.pos),
                rotate:     player.rotateDegree.clone(),
                session:    {
                    user_id: player.session.user_id
                }
            };
            const [actions, pos] = await doBlockAction(packet.data, world, player_info, currentInventoryItem)
            const canDo = correct_destroy && actions != null
            if (!canDo) { // if can't do the actions - tell the client to rollback its actions
                if (pos) {
                    // We have this block. Send it.
                    const block = world.getBlock(pos, tmpBlock)
                    const chunk = block.chunk as ServerChunk
                    const packets: INetworkMessage[] = [
                        {
                            name: ServerClient.CMD_BLOCK_SET,
                            data: {
                                action_id: ServerClient.BLOCK_ACTION_CREATE,
                                pos,
                                item: block.clonePOJO()
                            }
                        },
                        chunk.createFluidDeltaPacketAt(pos)
                    ]
                    world.sendSelected(packets, player)
                } else if (packet.data.snapshotId != null) {
                    // we don't have this block. Tell the client to rollback from its history
                    world.sendSelected([{
                        name: ServerClient.CMD_BLOCK_ROLLBACK,
                        data: packet.data.snapshotId
                    }], player)
                }
                return true
            }
            // проверям скорость, если ошибка, то ворачиваем как было
            if (!correct_destroy) {
                for (const block of actions.blocks.list) {
                    // TODO: extra_data надо восстанавлиать
                    // TODO: тут точно нет доверия данным от игрока?
                    block.item.id = block.destroy_block.id;
                }
            }
            // compare two actions
            const player_modify_blocks = packet.data.actions?.blocks?.list
            if (Array.isArray(player_modify_blocks) && player_modify_blocks.length > 0) {
                const player_json = JSON.stringify(packet.data.actions.blocks.list);
                const server_json = JSON.stringify(actions.blocks.list);
                const same_results = player_json == server_json;
                if(!same_results || !correct_destroy) {
                    // собрать патч, для мира игрока:
                    const patch_blocks = new VectorCollector();
                    // 1. вложить в патч реальные блоки на указанных игроком позициях изменённых блоков
                    for(const item of packet.data.actions.blocks.list) {
                        if ('pos' in item) {
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