import { DBItemBlock } from "./blocks.js";
import { DEFAULT_MOB_TEXTURE_NAME, MOB_TYPE } from "./constant.js";
import { Vector, VectorCollector } from "./helpers.js";
import { Lang } from "./lang.js";
import type { Player } from "./player.js";
import { BLOCK_ACTION } from "./server_client.js";
import type { TBlock } from "./typed_blocks3.js";
import { TActionBlock, WorldAction } from "./world_action.js";

export const MAX_MECHANISM_VOLUME =  262144

export class MechanismAssembler {
    player : Player
    pos1? : Vector = null
    pos2? : Vector = null
    max_volume: int = MAX_MECHANISM_VOLUME

    constructor(player : Player) {
        this.player = player
    }

    setPos1(pos: Vector) {
        this.pos1 = new Vector().copyFrom(pos)
    }

    setPos2(pos: Vector) : IQuboidInfo | null {
        if(this.pos1 && this.pos1.equal(pos)) {
            this.discard()
            return null
        }
        const qi = MechanismAssembler.getCuboidInfo(this.pos1, pos)
        if(qi.volume > this.max_volume) {
            throw `error_max_volume|${this.max_volume}`
        }
        this.reset()
        return qi
    }

    reset() {
        this.pos1 = null
        this.pos2 = null
    }

    discard() {
        this.reset()
        const msg = 'assembly_discarded'
        Qubatch.hotbar.strings.setText(1, msg, 4000)
    }

    // Return quboid info
    static getCuboidInfo(pos1: Vector, pos2: Vector) : IQuboidInfo {
        if(!pos1) {
            throw 'error_pos1_not_defined';
        }
        if(!pos2) {
            throw 'error_pos2_not_defined';
        }
        const volume = pos1.volume(pos2);
        if(volume < 1) {
            throw 'error_volume_0';
        }
        return {
            pos1:   pos1.clone(),
            volume: volume,
            volx:   Math.abs(pos1.x - pos2.x) + 1,
            voly:   Math.abs(pos1.y - pos2.y) + 1,
            volz:   Math.abs(pos1.z - pos2.z) + 1,
            signx:  pos1.x > pos2.x ? -1 : 1,
            signy:  pos1.y > pos2.y ? -1 : 1,
            signz:  pos1.z > pos2.z ? -1 : 1
        } as IQuboidInfo
    }

    static useMechanismAssemblerWorldAction(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions : WorldAction): boolean {
        // 
        if(mat_block.item.name != 'instrument' || mat_block.item.instrument_id != 'mechanism_assembler') {
            return false;
        }
        const bm = world.block_manager
        const real_player = Qubatch.is_server ? world.players.list.get(player.session.user_id) : Qubatch.player
        const try_reactivate = (world_material.id == bm.WINDMILL_BEARING.id) && world_block?.extra_data
        if (!Qubatch.is_server) {
            let msg = null
            const ma = (real_player as Player).mechanism_assembler
            if(!ma.pos1) {
                if(try_reactivate) {
                    return true
                }
                ma.setPos1(pos)
                msg = 'click_again_to_confirm'
            } else {
                const qi = ma.setPos2(pos)
                if(qi) {
                    actions.appendMechanismBlocks(qi)
                }
            }
            if(msg) {
                Qubatch.hotbar.strings.setText(1, Lang[msg], 4000)
            }
            return true
        } else {

            const mechanism_cmd = e.actions?.mechanism

            if(mechanism_cmd) {

                switch(mechanism_cmd.action) {
                    case 'append_blocks': {
                        const qi : IQuboidInfo = mechanism_cmd.append_blocks
                        const pos = new Vector(0, 0, 0)
                        const bm = world.block_manager
                        const windmill_bearing_id = bm.fromName('WINDMILL_BEARING').id
                        const actions = new WorldAction(null, null, true, false)
                        let mob_id = null
                        for(let x = 0; x < qi.volx; x++) {
                            for(let y = 0; y < qi.voly; y++) {
                                for(let z = 0; z < qi.volz; z++) {
                                    pos.copyFrom(qi.pos1).addScalarSelf(x * qi.signx, y * qi.signy, z * qi.signz)
                                    const tblock = world.getBlock(pos)
                                    if(tblock && tblock.id > 0) {
                                        const item = tblock.convertToDBItem()
                                        if(!item.extra_data) {
                                            item.extra_data = {}
                                        }
                                        if(tblock.extra_data?.mob_id) {
                                            mob_id = tblock.extra_data?.mob_id
                                        }
                                        actions.addBlocks([{pos: pos.clone(), item, action_id: BLOCK_ACTION.MODIFY}])
                                    }
                                }
                            }
                        }
                        if(actions.blocks.list.length > 0) {
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
                                    // MobSpawnParams
                                    const params = {
                                        skin:       {
                                            model_name: model_name,
                                            texture_name: DEFAULT_MOB_TEXTURE_NAME
                                        },
                                        pos:        spawn_pos,
                                        pos_spawn:  spawn_pos.clone(),
                                        rotate:     new Vector(0, 0, 0).toAngles()
                                    }
                                    // const params = new MobSpawnParams(spawn_pos, Vector.ZERO.clone(), {model_name, texture_name: DEFAULT_MOB_TEXTURE_NAME})
                                    const mob = (world as any).mobs.create(params)
                                    mob_id = mob.id
                                }
                            }

                            if(!mob_id) {
                                world.chat.sendSystemChatMessageToSelectedPlayers(`error_mechanism_not_connected_to_windmill_bearing`, real_player)
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
                            world.chat.sendSystemChatMessageToSelectedPlayers(`added_blocks|${actions.blocks.list.length}`, real_player)

                        }
                        break
                    }
                }

            } else if(try_reactivate) {
                const mob_id = world_block.extra_data.mob_id
                if(mob_id) {
                    const extra_data = world_block.extra_data
                    const mob = world.mobs.get(mob_id)
                    if(mob) {
                        const invisible = !mob.extra_data.invisible
                        mob.extra_data.invisible = invisible
                        extra_data.invisible = invisible
                        if(invisible) {
                            // stop rotation
                            // restore world blocks
                            if(mob.extra_data.blocks) {
                                for(let pos_key in mob.extra_data.blocks) {
                                    const item = mob.extra_data.blocks[pos_key]
                                    const pos_arr = pos_key.split(',')
                                    const pos = new Vector().setScalar(parseFloat(pos_arr[0]), parseFloat(pos_arr[1]), parseFloat(pos_arr[2])).addSelf(world_block.posworld)
                                    if(!pos.equal(world_block.posworld)) {
                                        const existing_block = world.getBlock(pos) as TBlock
                                        if(existing_block && existing_block.id > 0) {
                                            actions.addParticles([
                                                {
                                                    type: 'destroy_block', 
                                                    pos: pos.add(new Vector(.5, .5, .5)), 
                                                    block: {
                                                        id: existing_block.id
                                                    },
                                                    force: 1,
                                                    scale: 1,
                                                    small: false
                                                }
                                            ])
                                        }
                                        actions.addBlocks([{pos, item, action_id: BLOCK_ACTION.MODIFY} as TActionBlock])
                                    }
                                }
                                delete(mob.extra_data.blocks)
                                mob.getBrain().stopRotation()
                            }
                        } else {
                            // start rotation
                            // destroy world blocks
                            const item_air = new DBItemBlock(0)
                            const mob_blocks = new VectorCollector()
                            const ndbs = {}
                            let count = 0
                            const max_volume = MAX_MECHANISM_VOLUME
                            const findNeighbours = (mob_id : int, pos: Vector) => {
                                const n = world.getBlock(pos) as TBlock
                                if(n.extra_data?.mob_id == mob_id) {
                                    if(!mob_blocks.has(pos)) {
                                        //
                                        const addBlock = (n : TBlock, pos : Vector) => {
                                            const ndb = n.convertToDBItem()
                                            if(pos.equal(world_block.posworld)) {
                                                ndb.extra_data = JSON.parse(JSON.stringify(ndb.extra_data))
                                                ndb.extra_data.invisible = true
                                                ndb.extra_data.in_mesh = true
                                            } else {
                                                actions.addBlocks([{pos: pos.clone(), item: item_air, action_id: BLOCK_ACTION.REPLACE}])
                                            }
                                            if(count++ > max_volume) {
                                                throw `error_max_volume|${max_volume}`
                                            }
                                            //
                                            mob_blocks.set(pos, ndb)
                                            const pos_key = pos.sub(world_block.posworld).toHash()
                                            ndbs[pos_key] = ndb
                                        }
                                        //
                                        addBlock(n, pos)
                                        //
                                        const head_connected_block = n.getHeadBlock(world)
                                        if(head_connected_block) {
                                            addBlock(head_connected_block, head_connected_block.posworld)
                                        }
                                        //
                                        findNeighbours(mob_id, pos.add(Vector.XN))
                                        findNeighbours(mob_id, pos.add(Vector.YN))
                                        findNeighbours(mob_id, pos.add(Vector.ZN))
                                        findNeighbours(mob_id, pos.add(Vector.XP))
                                        findNeighbours(mob_id, pos.add(Vector.YP))
                                        findNeighbours(mob_id, pos.add(Vector.ZP))
                                    }
                                }
                            }
                            findNeighbours(mob_id, world_block.posworld.clone())
                            if(mob_blocks.size > 0) {
                                actions.blocks.options.on_block_set = false
                                mob.extra_data.blocks = ndbs // из каких блоков состоит моб
                                mob.extra_data.rotate = new Vector().copyFrom(world_block.rotate) // чтобы моб правильно рисовал сам блок привода
                                mob.getBrain().startRotation()
                            }
                        }
                        actions.addBlocks([{pos: new Vector(pos), item: {id: world_block.id, rotate: world_block.rotate, extra_data}, action_id: BLOCK_ACTION.MODIFY}])
                    } else {
                        actions.error = 'error_mob_not_found'
                    }
                    return true
                }
            }
        }
        return false
    }

}