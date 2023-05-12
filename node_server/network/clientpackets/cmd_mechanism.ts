import { ServerClient } from "@client/server_client.js";
import { WorldAction } from "@client/world_action.js";
import { Vector } from "@client/helpers.js";
import { DEFAULT_MOB_TEXTURE_NAME, MOB_TYPE } from "@client/constant.js";
import { TBlock } from "@client/typed_blocks3.js";
import type { ServerPlayer } from "../../server_player.js";
import { MechanismAssembler } from "@client/mechanism_assembler.js";
import { MobSpawnParams } from "mob.js";

const tmpBlock = new TBlock()

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return true
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_MECHANISM;
    }

    // Pickat action
    static async read(player: ServerPlayer, packet: INetworkMessage<any>) {

        // ВАЖНО: нужно гарантировать что во всех возможных случаях или вызовется player.controlManager.syncWithEvent(data),
        // или data.controlEventId будет перенесен куда-то еще (например, в WorldAction), и с ним позже вызовется синхронизация управления.

        const data = packet.data
        if(!player.game_mode.canBlockAction()) {
            player.controlManager.syncWithEvent(data)
            return true
        }

        //
        const world = player.world
        const currentInventoryItem = player.inventory.current_item

        const action = data.action
        const args = data.args

        switch(action) {
            case 'assembly': {
                const pos1 = new Vector().copyFrom(args.pos1)
                const pos2 = new Vector().copyFrom(args.pos2)
                const qi = MechanismAssembler.getCuboidInfo(pos1, pos2)
                // const blocks = new VectorCollector()
                const pos = new Vector(0, 0, 0)
                const bm = world.block_manager
                const windmill_bearing_id = bm.fromName('WINDMILL_BEARING').id
                const actions = new WorldAction(null, null, true, false)
                let mob_id = null
                for(let x = 0; x < qi.volx; x++) {
                    for(let y = 0; y < qi.voly; y++) {
                        for(let z = 0; z < qi.volz; z++) {
                            pos.copyFrom(pos1).addScalarSelf(x * qi.signx, y * qi.signy, z * qi.signz)
                            const tblock = world.getBlock(pos)
                            if(tblock && tblock.id >= 0) {
                                const item = tblock.convertToDBItem()
                                if(!item.extra_data) {
                                    item.extra_data = {}
                                }
                                if(tblock.extra_data?.mob_id) {
                                    mob_id = tblock.extra_data?.mob_id
                                }
                                actions.addBlocks([{pos: pos.clone(), item, action_id: ServerClient.BLOCK_ACTION_MODIFY}])
                            }
                        }
                    }
                }
                if(actions.blocks.list.length > 0) {
                    data.controlEventId = null
                    //
                    if(!mob_id) {
                        let new_mob_pos = null
                        for(let action_block of actions.blocks.list) {
                            if(action_block.item.extra_data.mob_id) {
                                mob_id = action_block.item.extra_data.mob_id
                                if(action_block.item.id == windmill_bearing_id) {
                                    mob_id = action_block.item.extra_data.mob_id
                                    break
                                }
                            } else {
                                if(action_block.item.id === windmill_bearing_id) {
                                    if(!new_mob_pos) {
                                        new_mob_pos = action_block.pos.clone()
                                    }
                                }
                            }
                        }
                        if(!mob_id && new_mob_pos) {
                            // const mob = world.mobs.get(4)
                            const model_name = MOB_TYPE.WINDMILL_BEARING
                            const spawn_pos = new Vector().copyFrom(new_mob_pos).addScalarSelf(0.5, 0, 0.5)
                            const params = new MobSpawnParams(spawn_pos, Vector.ZERO.clone(), {model_name, texture_name: DEFAULT_MOB_TEXTURE_NAME})
                            const mob = world.mobs.create(params)
                            mob_id = mob.id
                        }
                    }

                    if(!mob_id) {
                        world.chat.sendSystemChatMessageToSelectedPlayers(`error_mechanism_not_connected_to_windmill_bearing`, player)
                        return true
                    }
                    
                    //
                    for(let action_block of actions.blocks.list) {
                        action_block.item.extra_data.mob_id = mob_id
                        if(action_block.item.id > 0) {
                            actions.addParticles([{ type: 'villager_happy', pos: action_block.pos }])
                        }
                    }
                    // добавить действие в мир
                    world.actions_queue.add(player, actions)
                }
                break
            }
        }

        // data.controlEventId = null
        player.controlManager.syncWithEvent(data)
        return true

    }

}