import { DBItemBlock } from "./blocks.js";
import { Vector, VectorCollector } from "./helpers.js";
import type { Player } from "./player.js";
import { ServerClient } from "./server_client.js";
import type { TBlock } from "./typed_blocks3.js";
import type { TActionBlock, WorldAction } from "./world_action.js";

export class MechanismAssembler {
    player : Player
    pos1? : Vector = null
    pos2? : Vector = null

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
        this.pos2 = new Vector().copyFrom(pos)
        const qi = MechanismAssembler.getCuboidInfo(this.pos1, this.pos2)
        const player = this.player
        const {pos1, pos2} = this
        player.world.server.Send({name: ServerClient.CMD_MECHANISM, data: {action: 'assembly', args: {pos1, pos2}}})
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
                msg = 'Click again to confirm'
            } else {
                if(!ma.pos1) {
                    debugger
                }
                ma.setPos2(pos)
                const volume = ma.pos1.volume(ma.pos2)
                msg = `Added ${volume} blocks`
            }
            if(msg) {
                Qubatch.hotbar.strings.setText(1, msg, 4000)
            }
            return true
        } else {
            if(try_reactivate) {
                const mob_id = world_block.extra_data.mob_id
                if(mob_id) {
                    const extra_data = world_block.extra_data
                    const mob = world.mobs.get(mob_id)
                    if(mob) {
                        const invisible = !mob.extra_data.invisible
                        mob.extra_data.invisible = invisible
                        extra_data.invisible = invisible
                        if(invisible) {
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
                                        actions.addBlocks([{pos, item, action_id: ServerClient.BLOCK_ACTION_MODIFY} as TActionBlock])
                                    }
                                }
                                delete(mob.extra_data.blocks)
                            }
                        } else {
                            // destroy world blocks
                            const item_air = new DBItemBlock(0)
                            const mob_blocks = new VectorCollector()
                            const ndbs = {}
                            const findNeighbours = (mob_id : int, pos: Vector) => {
                                const n = world.getBlock(pos) as TBlock
                                if(n.extra_data?.mob_id == mob_id) {
                                    if(!mob_blocks.has(pos)) {
                                        const ndb = n.convertToDBItem()
                                        if(pos.equal(world_block.posworld)) {
                                            ndb.extra_data = JSON.parse(JSON.stringify(ndb.extra_data))
                                            ndb.extra_data.invisible = true
                                            ndb.extra_data.in_mesh = true
                                        } else {
                                            actions.addBlocks([{pos: pos.clone(), item: item_air, action_id: ServerClient.BLOCK_ACTION_REPLACE}])
                                        }
                                        mob_blocks.set(pos, ndb)
                                        const pos_key = pos.sub(world_block.posworld).toHash()
                                        ndbs[pos_key] = ndb
                                        findNeighbours(mob_id, pos.add(Vector.XN))
                                        findNeighbours(mob_id, pos.add(Vector.YN))
                                        findNeighbours(mob_id, pos.add(Vector.ZN))
                                        findNeighbours(mob_id, pos.add(Vector.XP))
                                        findNeighbours(mob_id, pos.add(Vector.YP))
                                        findNeighbours(mob_id, pos.add(Vector.ZP))
                                    }
                                }
                            }
                            // const pn = performance.now()
                            findNeighbours(mob_id, world_block.posworld.add(Vector.YP))
                            if(mob_blocks.size > 0) {
                                actions.blocks.options.on_block_set = false
                                mob.extra_data.blocks = ndbs
                                // console.log(mob_blocks.size, performance.now() - pn)
                                // console.log(JSON.stringify(ndbs))
                            }
                        }
                        actions.addBlocks([{pos: new Vector(pos), item: {id: world_block.id, rotate: world_block.rotate, extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}])
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