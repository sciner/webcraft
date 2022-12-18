import {ROTATE, Vector, VectorCollector, Helpers, DIRECTION, getChunkAddr } from "./helpers.js";
import { AABB } from './core/AABB.js';
import {CubeSym} from './core/CubeSym.js';
import { BLOCK, FakeTBlock } from "./blocks.js";
import {ServerClient} from "./server_client.js";
import { Resources } from "./resources.js";
import {impl as alea} from '../vendors/alea.js';
import { RailShape } from "./block_type/rail_shape.js";
import { WorldPortal } from "./portal.js";
import {
    FLUID_LAVA_ID,
    FLUID_WATER_ID,
    FLUID_TYPE_MASK, isFluidId
} from "./fluid/FluidConst.js";
import { COVER_STYLE_SIDES } from "./constant.js";

const _createBlockAABB = new AABB();

const MAX_SIZE_PORTAL = 21;

const sides = [
    new Vector(1, 0, 0),
    new Vector(-1, 0, 0),
    new Vector(0, 1, 0),
    new Vector(0, -1, 0),
    new Vector(0, 0, 1),
    new Vector(0, 0, -1)
];

const rotates = [
    new Vector(13, 0, 0), // CubeSym.ROT_Z3
    new Vector(22, 0, 0), // CubeSym.ROT_Z
    new Vector(CubeSym.ROT_Y3, 0, 0),
    new Vector(CubeSym.ROT_X2, 0, 0),
    new Vector(18, 0, 0), // CubeSym.ROT_X3
    new Vector(CubeSym.ROT_X, 0, 0)
];

function calcRotateByPosN(rot, pos_n) {
    if (Math.abs(pos_n.y) === 1) {
        rot = new Vector(rot);
        rot.x = BLOCK.getCardinalDirection(rot);
        rot.z = 0;
        rot.y = pos_n.y; // mark that is up
        return rot;
    } else {
        for(let i in sides) {
            let side = sides[i];
            if(side.equal(pos_n)) {
                return rotates[i];
            }
        }
    }
    throw 'error_invalid_pos_n';

}

// Calc rotate
function calcRotate(rotate, n, can_set_on_wall) {
    rotate = new Vector(rotate);
    rotate.x = 0;
    rotate.y = 0;
    // top normal
    if (!can_set_on_wall || (can_set_on_wall && Math.abs(n.y) === 1)) {
        rotate.x = BLOCK.getCardinalDirection(rotate);
        rotate.z = 0;
        rotate.y = n.y; // mark that is up
    } else {
        rotate.z = 0;
        if (n.x !== 0) {
            rotate.x = n.x > 0 ? ROTATE.E : ROTATE.W;
        } else {
            rotate.x = n.z > 0 ? ROTATE.N : ROTATE.S;
        }
    }
    return rotate;
}

// createPainting...
async function createPainting(e, world, pos) {
    const pos_n = pos.n;
    pos = new Vector(pos);
    if(pos_n.x == -1) {
        pos.z--;
    }
    if(pos_n.z == 1) {
        pos.x--;
    }
    const center_pos = new Vector(pos);
    let field = null;
    let fixed_field = null;
    if(pos_n.x) {
        field = 'z';
        fixed_field = 'x';
    } else if(pos_n.z) {
        field = 'x';
        fixed_field = 'z';
    }
    if(!field) {
        return false;
    }
    let painting_sizes = [
        // 4x4
        {
            name: '4x4',
            move: {y : 1},
            list: [
                {y: 2, f: -1}, {y: 2, f: 0}, {y: 2, f: 1}, {y: 2, f: 2},
                {y: 1, f: -1}, {y: 1, f: 0}, {y: 1, f: 1}, {y: 1, f: 2},
                {y: 0, f: -1}, {y: 0, f: 0}, {y: 0, f: 1}, {y: 0, f: 2},
                {y: -1, f: -1}, {y: -1, f: 0}, {y: -1, f: 1}, {y: -1, f: 2}
            ]
        },
        // 4x3
        {
            name: '4x3',
            move: {y : 1},
            list: [
                {y: 1, f: -1}, {y: 1, f: 0}, {y: 1, f: 1}, {y: 1, f: 2},
                {y: 0, f: -1}, {y: 0, f: 0}, {y: 0, f: 1}, {y: 0, f: 2},
                {y: -1, f: -1}, {y: -1, f: 0}, {y: -1, f: 1}, {y: -1, f: 2}
            ]
        },
        // 4x2
        {
            name: '4x2',
            move: {y : 1},
            list: [
                {y: 1, f: -1}, {y: 1, f: 0}, {y: 1, f: 1}, {y: 1, f: 2},
                {y: 0, f: -1}, {y: 0, f: 0}, {y: 0, f: 1}, {y: 0, f: 2}
            ]
        },
        // 2x2
        {
            name: '2x2',
            move: {y : 2},
            list: [
                {y: 0, f: 0}, {y: 1, f: 0},
                {y: 0, f: 1}, {y: 1, f: 1}
            ]
        },
        // 2x1
        {
            name: '2x1',
            move: {y : 1},
            list: [
                {y: 0, f: 0}, {y: 0, f: 1}
            ]
        },
        // 1x2
        {
            name: '1x2',
            move: {y : 2},
            list: [
                {y: 0, f: 0}, {y: 1, f: 0}
            ]
        },
        // 1x1
        {
            name: '1x1',
            move: {y : 1},
            list: [
                {y: 0, f: 0}
            ]
        }
    ];
    let blocks = new VectorCollector();
    let blocks_back = new VectorCollector();
    let bpos = new Vector(center_pos);
    let bpos_back = new Vector(center_pos);
    for(let item of painting_sizes) {
        item.size = item.name.split('x').map(x => parseInt(x));
        let ok = true;
        let painting_pos = null;
        for(let pp of item.list) {
            bpos.y = center_pos.y + pp.y;
            bpos[field] = center_pos[field] + pp.f;
            bpos[fixed_field] = center_pos[fixed_field];
            //
            if(item.size[0] == 1) {
                if(pos_n.x == -1) bpos.z++;
                if(pos_n.z == 1) bpos.x++;
            }
            if(!painting_pos) {
                painting_pos = new Vector(bpos);
            }
            let pb = blocks.get(bpos);
            //
            bpos_back.set(bpos.x, bpos.y, bpos.z);
            bpos_back[fixed_field] -= pos_n[fixed_field];
            let pb_back = blocks_back.get(bpos_back);
            if(!pb) {
                pb = world.getBlock(bpos);
                blocks.set(bpos, pb);
                //
                pb_back = world.getBlock(bpos_back);
                blocks_back.set(bpos_back, pb_back);
            }
            if((pb.id == 0 || pb.material.planting) && pb_back.id != 0) {
                // ok
            } else {
                ok = false;
                break;
            }
        }
        if(ok) {
            const size = item.name.split('x').map(x => parseInt(x));
            let aabb = new AABB();
            const w = 2/16;
            painting_pos.y += item.move.y;
            if(pos_n.x < 0) painting_pos.x += 1 - w;
            if(pos_n.z < 0) painting_pos.z += 1 - w;
            const second_corner = new Vector(painting_pos);
            second_corner[field] += size[0];
            second_corner[fixed_field] += w;
            second_corner.y -= size[1];
            aabb.set(painting_pos.x, second_corner.y, painting_pos.z, second_corner.x, painting_pos.y, second_corner.z);
            // Find image_name
            const paintings = await Resources.loadPainting();
            const col = paintings.sizes.get(item.name);
            const keys = Array.from(col.keys());
            const random = new alea(e.id);
            const image_name = keys[Math.floor(random.double() * keys.length)];
            //
            return {
                entity_id:  randomUUID(),
                aabb:       aabb.toArray(),
                size:       size,
                image_name: image_name,
                pos:        center_pos,
                pos_n:      pos_n
            };
            break;
        }
    }
    return null;
}

//
function makeDropItem(block, item) {
    if(block.hasTag('bee_nest')) {
        item.extra_data = JSON.parse(JSON.stringify(block.extra_data));
        item.entity_id = block.entity_id || randomUUID();
        item.count = 1;
    }
    return item;
}

/**
 * Drop block
 * 
 * @param {*} player 
 * @param {*} block 
 * @param { WorldAction } actions 
 * @param {*} force 
 * 
 * @returns {object[]} dropped blocks
 */
function dropBlock(player, block, actions, force) {
    /*const isSurvival = true; // player.game_mode.isSurvival()
    if(!isSurvival) {
        return;
    }*/
    if(block.material.tags.includes('no_drop')) {
        return [];
    }

    if(block.material.drop_item) {
        const drop_block = BLOCK.fromName(block.material.drop_item?.name);
        if(drop_block) {
            if('chance' in block.material.drop_item) {
                let count = block.material.drop_item.count;
                if(count) {
                    if(Math.random() <= block.material.drop_item.chance) {
                        if(Array.isArray(count)) {
                            // const rnd = (Math.random() * (max-min + 1) + min) | 0;
                            let count_index = (Math.random() * count.length) | 0;
                            count = count[count_index];
                        }
                        count = parseInt(count);
                        if(count > 0) {
                            const item = makeDropItem(block, {id: drop_block.id, count: count});
                            actions.addDropItem({pos: block.posworld.add(new Vector(.5, 0, .5)), items: [item], force: !!force});
                            return [item]
                        }
                    }
                }
            }
        } else {
            console.error('error_invalid_drop_item', block.material.drop_item);
        }
    } else {
        const items = [];
        // check if seeds
        if(block.material.seeds) {
            let result = null;
            if(block.extra_data.complete) {
                result = block.material.seeds.result?.complete;
            } else {
                result = block.material.seeds.result?.incomplete;
            }
            if(result) {
                for(let r of result) {
                    const count = Helpers.getRandomInt(r.count.min, r.count.max);
                    if(count > 0) {
                        const result_block = BLOCK.fromName(r.name.toUpperCase());
                        if(!result_block || result_block.id < 0) {
                            throw 'error_invalid_result_block|' + r.name;
                        }
                        items.push(makeDropItem(block, {id: result_block.id, count: count}));
                    }
                }
            }
        // default drop item
        } else if(block.material.spawnable) {
            items.push(makeDropItem(block, {id: block.id, count: 1}));
        }
        for(let item of items) {
            actions.addDropItem({pos: block.posworld.add(new Vector(.5, 0, .5)), items: [item], force: !!force});
        }
        return items
    }
    return [];
}

// DestroyBlocks
class DestroyBlocks {

    /**
     * @param { import("../../node_server/server_world.js").ServerWorld } world
     * @param { import("../../node_server/server_player.js").ServerPlayer } player
     * @param { WorldAction } actions 
     */
    constructor(world, player, actions) {
        this.cv         = new VectorCollector();
        this.world      = world;
        this.player     = player;
        this.actions    = actions;
    }

    //
    add(tblock, pos, no_drop = false) {
        const cv        = this.cv;
        const world     = this.world;
        const player    = this.player;
        const actions   = this.actions;
        if(cv.has(tblock.posworld)) {
            return false;
        }
        cv.add(tblock.posworld, true);
        actions.addBlocks([{pos: tblock.posworld, item: {id: BLOCK.AIR.id}, destroy_block_id: tblock.id, action_id: ServerClient.BLOCK_ACTION_DESTROY}]);
        //
        if(tblock.material.sound) {
            actions.addPlaySound({tag: tblock.material.sound, action: 'dig', pos: new Vector(pos), except_players: [player.session.user_id]});
        }
        const drop_items = [];
        //
        if(tblock.material.is_jukebox) {
            // If disc exists inside jukebox
            if(tblock.extra_data && tblock.extra_data.disc) {
                const disc_id = tblock.extra_data.disc.id;
                // Drop disc
                drop_items.push(...dropBlock(player, new FakeTBlock(disc_id, null, tblock.posworld.clone(), null, null, null, null, null, null), actions, false));
                // Stop play disc
                actions.stop_disc.push({pos: tblock.posworld.clone()});
            }
        }
        // Drop block if need
        if(!no_drop) {
            drop_items.push(...dropBlock(player, tblock, actions, false));
        }
        // Destroy connected blocks
        for(let cn of ['next_part', 'previous_part']) {
            let part = tblock.material[cn];
            if(part) {
                const connected_pos = tblock.posworld.add(part.offset_pos);
                if(!cv.has(connected_pos)) {
                    let block_connected = world.getBlock(connected_pos);
                    if(block_connected.id == part.id) {
                        this.add(block_connected, pos);
                    }
                }
            }
        }
        // Удаляем второй блок (кровати, двери, высокая трава и высокие цветы)
        if(tblock.material.has_head) {
            const head_pos = new Vector(tblock.material.has_head.pos);
            const connected_pos = new Vector(pos);
            if(tblock.rotate && head_pos.z) {
                let rot = tblock.rotate.x;
                if(!tblock.extra_data?.is_head) {
                    rot += 2;
                }
                connected_pos.addByCardinalDirectionSelf(head_pos, rot);
            } else {
                if(tblock.extra_data?.is_head) {
                    head_pos.multiplyScalar(-1);
                }
                connected_pos.addSelf(head_pos);
            }
            const block_connected = world.getBlock(connected_pos);
            if(block_connected.id == tblock.id) {
                this.add(block_connected, connected_pos, true);
            }
        }
        // Destroy chain blocks to down
        if(tblock.material.destroy_to_down) {
            let npos = tblock.posworld.add(Vector.YN);
            let nblock = world.getBlock(npos);
            if(nblock && tblock.material.destroy_to_down.indexOf(nblock.material.name) >= 0) {
                this.add(nblock, pos);
            }
        }
        //
        if(tblock.material.is_chest) {
            actions.dropChest(tblock)
        }
        //
        if(tblock.material.style == 'cover' && tblock.extra_data) {
            const existing_faces = Object.keys(tblock.extra_data).filter(value => COVER_STYLE_SIDES.includes(value));
            const dcount = existing_faces.length
            if(dcount > 1 && drop_items.length == 1) {
                drop_items[0].count = dcount
            }           
        }
    }

}

// WorldAction
export class WorldAction {

    #world;

    constructor(id, world, ignore_check_air = false, on_block_set = true, notify = null) {
        this.#world = world;
        //
        Object.assign(this, {
            id:                         id,
            error:                      null,
            chat_message:               null,
            create_chest:               null,
            load_chest:                 null,
            open_window:                null,
            put_in_backet:              null,
            clone_block:                false,
            reset_mouse_actions:        false,
            decrement:                  false,
            decrement_extended:         null,
            decrement_instrument:       false,
            increment:                  null,
            ignore_creative_game_mode:  false,
            sitting:                    false,
            notify:                     notify,
            fluids:                     [],
            fluidFlush:                 false,
            blocks: {
                list: [],
                options: {
                    ignore_check_air: ignore_check_air,
                    on_block_set: on_block_set
                }
            },
            play_sound:                 [],
            stop_disc:                  [],
            drop_items:                 [],
            generate_particles:         [],
            mobs:                       {spawn: [], activate: []},
            generate_tree:              [],
        });
    }

    // Add play sound
    addPlaySound(item) {
        this.play_sound.push(item);
    }

    // Add block
    addBlocks(items) {
        for(let i = 0; i < items.length; i++) {
            const item = items[i];
            /*if(!item.item.extra_data && item.item.id > 0) {
                const extra_data = BLOCK.makeExtraData(item.item, item.pos);
                if(extra_data) {
                    throw 'error_empty_extra_data';
                    // item.item.extra_data = extra_data;
                }
            }*/
            if(item.pos.x != Math.floor(item.pos.x)) throw 'error_invalid_block_pos';
            if(item.pos.y != Math.floor(item.pos.y)) throw 'error_invalid_block_pos';
            if(item.pos.z != Math.floor(item.pos.z)) throw 'error_invalid_block_pos';
        }
        this.blocks.list.push(...items);
    }

    addFluids(fluids, offset) {
        offset = offset || Vector.ZERO;
        for (let i = 0; i < fluids.length; i += 4) {
            this.fluids.push(fluids[i + 0] + offset.x, fluids[i + 1] + offset.y, fluids[i + 2] + offset.z, fluids[i + 3]);
        }
    }

    // Add drop item
    addDropItem(item) {
        this.drop_items.push(item);
    }

    //
    addParticles(items) {
        this.generate_particles.push(...items);
    }

    //
    putInBucket(item) {
        if(this.put_in_backet) {
            throw 'error_put_already';
        }
        this.put_in_backet = item;
    }

    //
    dropChest(tblock) {
        if(!tblock.extra_data?.slots) {
            return false;
        }
        for(let i in tblock.extra_data.slots) {
            const slot_item = tblock.extra_data.slots[i];
            if(slot_item) {
                this.addDropItem({
                    force: true,
                    pos: tblock.posworld,
                    items: [
                        // @todo need to calculate drop item ID and count
                        slot_item
                    ]
                });
            }
        }
    }

    /**
     * Make explosion
     * @param {Vector} vec_center 
     * @param {float} rad 
     * @param {boolean} add_particles 
     * @param {float} drop_blocks_chance 
     * @param {float} power 
     */
    makeExplosion(vec_center, rad = 3, add_particles, drop_blocks_chance, power = .5) {
        
        const world = this.#world;
        const air = { id: 0 };
        const block_pos = new Vector();
        const extruded_blocks = new VectorCollector();
        drop_blocks_chance = parseFloat(drop_blocks_chance);

        //
        const createAutoDrop = (tblock) => {
            const mat = tblock.material;
            if(!mat.can_auto_drop) {
                return false;
            }
            if((!mat.is_chest && !Number.isNaN(drop_blocks_chance) && Math.random() > drop_blocks_chance) || tblock.id == BLOCK.TNT.id) {
                return false;
            }
            const pos = tblock.posworld.clone().addSelf(new Vector(.5, .5, .5));
            extruded_blocks.set(pos, 'drop');
            // drop
            this.addDropItem({
                force: true,
                pos: pos,
                items: [
                    // @todo need to calculate drop item ID and count
                    { id: mat.id, count: 1 }
                ]
            });
            if(mat.is_chest) {
                this.dropChest(tblock)
            }
            return true;
        };

        const distance              = rad;
        const maxDistance           = Math.ceil(distance * 1.1);
        const listBlockDestruction  = new VectorCollector();
        const vec                   = new Vector(0, 0, 0);
        const strength              = power; // (power + 1.) * .97;
        const bePresentBlock        = new VectorCollector(); // Массив присутствующих блоков в кэше, для оптимизации повторного изъятия данных блока

        let repeat = false;
        let rays = 0;

        const p = performance.now();

        for(let x = -maxDistance; x <= maxDistance; ++x) {
            for(let y = -maxDistance; y <= maxDistance; ++y) {
                for(let z = -maxDistance; z <= maxDistance; ++z) {

                    if(x == -maxDistance || x == maxDistance || y == -maxDistance || y == maxDistance || z == -maxDistance || z == maxDistance) {

                        rays++;

                        vec.set(x, y, z).normSelf();

                        // дистанция x * 0.9 ... x * 1.1
                        const dis = distance * (.9 + Math.random() * .2);
                        // Сила x * 0.7 ... x * 1.3
                        let res = strength * (.7 + Math.random() * .6);

                        let fx = vec_center.x;
                        let fy = vec_center.y;
                        let fz = vec_center.z;
                        let dis0 = 0;
                        let resistance = 0;

                        while(dis0 < dis && res > 0) {
                            repeat = false;
                            block_pos.set(fx, fy, fz).flooredSelf();
                            let block = bePresentBlock.get(block_pos);
                            if(block) {
                                repeat = true;
                                resistance = block.resistance;
                            } else {
                                let tblock = world.getBlock(block_pos);
                                if(tblock.id > 0) {
                                    resistance = tblock.material.material.mining.blast_resistance;
                                } else {
                                    resistance = -100;
                                }
                                block = {resistance, tblock};
                                bePresentBlock.set(block_pos, block);
                            }
                            if (resistance >= 0) {
                                res -= (resistance + .3) * .3;
                                if (!repeat && res > 0) {
                                    listBlockDestruction.set(block_pos, block);
                                }
                            }
                            fx += vec.x;
                            fy += vec.y;
                            fz += vec.z;
                            dis0++;
                        }

                    }

                }
            }
        }

        /*console.log({
            rays,
            max_distance:       maxDistance,
            destroyed_blocks:   listBlockDestruction.size,
            get_blocks:         bePresentBlock.size,
            elapsed: performance.now() - p
        });
        */

        // Уничтожаем блоки
        if (listBlockDestruction.size > 0) {
            for(const [pos, block] of listBlockDestruction.entries()) {
                if (pos.equal(vec_center)) { // просто удаляем центральный блок ( это tnt)
                    this.addBlocks([
                        {pos: pos.clone(), item: {id: BLOCK.AIR.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY}
                    ]);
                } else if (block.tblock.id == BLOCK.TNT.id) {
                    // просто удаляем tnt с шаносом поджигания и взрыва
                    if (Math.random() < 0.7) {
                        this.addBlocks([
                            {pos: pos.clone(), item: {id: BLOCK.AIR.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY}
                        ]);
                    } else if (block.tblock.extra_data.fuse == 0) {
                        this.addBlocks([
                            {pos: pos.clone(), item: {id: BLOCK.TNT.id, extra_data:{explode: true, fuse: 0}}, action_id: ServerClient.BLOCK_ACTION_MODIFY}
                        ]);
                    }
                } else {
                    this.addBlocks([
                        {pos: pos.clone(), item: air, drop_blocks_chance}
                    ]);
                    extruded_blocks.set(pos, 'extruded');
                    createAutoDrop(block.tblock);
                }
            }
        }

        //
        for(let [vec, _] of extruded_blocks.entries()) {
            // 1. check under
            const check_under_poses = [
                vec.clone().addSelf(new Vector(0, 1, 0)),
                vec.clone().addSelf(new Vector(0, 2, 0))
            ];
            for(let i = 0; i < check_under_poses.length; i++) {
                const pos_under = check_under_poses[i];
                if(extruded_blocks.has(pos_under)) {
                    continue;
                }
                const tblock = world.getBlock(pos_under);
                if(!tblock) {
                    continue;
                }
                createAutoDrop(tblock);
            }
        }
        //
        if(add_particles) {
            this.addParticles([{type: 'explosion', pos: vec_center.clone()}]);
        }
    }

    /**
     * Set sitting
     * @param {Vector} pos 
     * @param {Vector} rotate 
     */
    setSitting(pos, rotate) {
        this.sitting = {pos, rotate};
        this.addPlaySound({tag: 'madcraft:block.cloth', action: 'hit', pos: new Vector(pos), except_players: [/*player.session.user_id*/]});
    }

    // Spawn mob (первая генерация моба, если его ещё не было в БД)
    spawnMob(params) {
        this.mobs.spawn.push(params);
    }

    // Activate mob (активация ранее созданного моба)
    activateMob(params) {
        this.mobs.activate.push(params);
    }

    generateTree(params) {
        this.generate_tree.push(params);
    }

}

// Called to perform an action based on the player's block selection and input.
export async function doBlockAction(e, world, player, current_inventory_item) {

    const actions = new WorldAction(e.id);
    const destroyBlocks = new DestroyBlocks(world, player, actions);

    if(e.pos == false) {
        console.error('empty e.pos');
        return actions;
    }

    let pos                 = e.pos;
    let world_block         = world.getBlock(pos);
    let world_material      = world_block && (world_block.id > 0 || world_block.fluid > 0) ? world_block.material : null;
    let extra_data          = world_block ? world_block.extra_data : null;
    let world_block_rotate  = world_block ? world_block.rotate : null;

    // protect from indirect changes
    if(extra_data) extra_data = JSON.parse(JSON.stringify(extra_data));

    // Check world block material
    if(!world_material && (e.cloneBlock || e.createBlock)) {
        console.error('error_empty_world_material', world_block.id, pos);
        return actions;
    }

    // 1. Change extra data
    if(e.changeExtraData) {
        for(let func of [editSign]) {
            if(await func(e, world, pos, player, world_block, world_material, null, current_inventory_item, world_block.extra_data, world_block_rotate, null, actions)) {
                return actions;
            }
        }
    }

    // 2. Destroy
    if(e.destroyBlock) {
        const NO_DESTRUCTABLE_BLOCKS = [BLOCK.BEDROCK.id, BLOCK.STILL_WATER.id];
        // 1. Проверка выполняемых действий с блоками в мире
        for(let func of [removeFromPot, deletePortal, removeFurnitureUpholstery]) {
            if(await func(e, world, pos, player, world_block, world_material, null, current_inventory_item, extra_data, world_block_rotate, null, actions)) {
                return actions;
            }
        }
        // 2.
        if(!world_material || NO_DESTRUCTABLE_BLOCKS.indexOf(world_material.id) < 0) {
            const tblock = world.getBlock(pos);
            if(tblock?.id > 0) {
                destroyBlocks.add(tblock, pos);
                //
                actions.decrement_instrument = {id: tblock.id};
                if(!tblock.material.destroy_to_down) {
                    // Destroyed block
                    pos = new Vector(pos);
                    // destroy plants over this block
                    let block_over = world.getBlock(pos.add(Vector.YP));
                    if(BLOCK.isPlants(block_over.id)) {
                        destroyBlocks.add(block_over, pos);
                    }
                }
            }
        }
        return actions;
    }

    // 3. Clone
    if(e.cloneBlock) {
        if(world_material && e.number == 1) {
            if(world_material.name == 'TEST' && world_block.extra_data) {
                console.log(world_block.extra_data);
            } else {
                actions.clone_block = e.pos;
            }
        }
        return actions;
    }

    // 4. Create
    if(e.createBlock) {

        // Получаем материал выбранного блока в инвентаре
        let mat_block = current_inventory_item ? BLOCK.fromId(current_inventory_item.id) : null;

        if(mat_block && mat_block.item?.emit_on_set) {
            // bucket etc.
            mat_block = BLOCK.fromName(mat_block.item.emit_on_set);
        }
        if(mat_block && mat_block.deprecated) {
            console.error('mat_block.deprecated');
            return actions;
        }

        // Проверка выполняемых действий с блоками в мире
        for(let func of [sitDown, getEggs, putIntoPot, needOpenWindow, ejectJukeboxDisc, pressToButton, goToBed, openDoor, eatCake, addCandle, openFenceGate, useTorch, setOnWater, putKelp]) {
            if(await func(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, world_block_rotate, null, actions)) {
                return actions;
            }
        }

        // Дальше идут действия, которые обязательно требуют, чтобы в инвентаре что-то было выбрано
        if(!current_inventory_item || current_inventory_item.count < 1) {
            console.error('no current_inventory_item');
            return actions;
        }

        // Проверка выполняемых действий с блоками в мире
        for(let func of [useShears, putDiscIntoJukebox, chSpawnmob, putInBucket, noSetOnTop, putPlate, setFurnitureUpholstery]) {
            if(await func(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, world_block_rotate, null, actions)) {
                return actions;
            }
        }

        // Другие действия с инструментами/предметами в руке
        if(mat_block.item) {

            // Use intruments
            for(let func of [useFlintAndSteel, useShovel, useHoe, useAxe, useBoneMeal]) {
                if(await func(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, world_block_rotate, null, actions)) {
                    return actions;
                }
            }
        } else if (mat_block.is_fluid) {
            if (world_material.is_solid) {
                pos.x += pos.n.x;
                pos.y += pos.n.y;
                pos.z += pos.n.z;
                world_block = world.getBlock(pos);
            }
            const origFluidType = (world_block.fluid & FLUID_TYPE_MASK);
            const myFluidType = (isFluidId(mat_block.id) & FLUID_TYPE_MASK);
            if (origFluidType > 0 && origFluidType !== myFluidType) {
                return actions;
            }
            actions.addFluids([0, 0, 0, myFluidType], pos);
            actions.decrement = true;
            actions.ignore_creative_game_mode = !!current_inventory_item.entity_id;
            if(mat_block.sound) {
                actions.addPlaySound({tag: mat_block.sound, action: 'place', pos: new Vector(pos), except_players: [player.session.user_id]});
            }
        } else {
            // Calc orientation
            let orientation = calcBlockOrientation(mat_block, player.rotate, pos.n);
            // Check if replace
            const replaceBlock = world_material && BLOCK.canReplace(world_material.id, world_block.extra_data, current_inventory_item.id);
            if(replaceBlock) {
                if(world_material.previous_part || world_material.next_part || current_inventory_item.style == 'ladder') {
                    return actions;
                }
                pos.n.x = 0;
                pos.n.y = 1;
                pos.n.z = 0;
                orientation = calcBlockOrientation(mat_block, player.rotate, pos.n);
            } else {
                if(await increaseLayering(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, world_block_rotate, null, actions)) {
                    return actions;
                }
                pos.x += pos.n.x;
                pos.y += pos.n.y;
                pos.z += pos.n.z;
                const block_on_posn = world.getBlock(pos);
                // Запрет установки блока, если на позиции уже есть другой блок
                if(!block_on_posn.canReplace()) {
                    console.error('!canReplace', block_on_posn.material.name);
                    return actions;
                }
            }

            // Запрет установки блока на блоки, которые занимает игрок
            if(mat_block.passable == 0 && mat_block.tags.indexOf("can_set_on_wall") < 0) {
                _createBlockAABB.set(pos.x, pos.y, pos.z, pos.x + 1, pos.y + 1, pos.z + 1);
                if(_createBlockAABB.intersect({
                    x_min: player.pos.x - player.radius / 2,
                    x_max: player.pos.x - player.radius / 2 + player.radius,
                    y_min: player.pos.y,
                    y_max: player.pos.y + player.height,
                    z_min: player.pos.z - player.radius / 2,
                    z_max: player.pos.z - player.radius / 2 + player.radius
                })) {
                    console.error('intersect with player');
                    return actions;
                }
            }

            // Некоторые блоки можно ставить только на что-то сверху
            if(!!mat_block.is_layering && !mat_block.layering.slab && pos.n.y != 1) {
                console.error('mat_block.is_layering');
                return actions;
            }

            // Некоторые блоки можно только подвешивать на потолок
            if(mat_block.tags.includes('place_only_to_ceil') && pos.n.y != -1) {
                console.error('place_only_to_ceil');
                return actions;
            }

            // Create block
            const new_item = {
                id: mat_block.id,
                rotate: orientation
            };
            for(const prop of ['entity_id', 'extra_data', 'power']) {
                if(prop in current_inventory_item) {
                    new_item[prop] = current_inventory_item[prop];
                }
            }
            new_item.extra_data = new_item.extra_data || BLOCK.makeExtraData(mat_block, pos, new_item.rotate, world);
            // If painting
            if(mat_block.id == BLOCK.PAINTING.id) {
                new_item.extra_data = await createPainting(e, world, pos);
                if(!new_item.extra_data) {
                    console.error('error_painting_data_is_empty');
                    return actions;
                }
            }
            // Material restrictions
            for(let func of [restrictPlanting, restrictOnlyFullFace, restrictLadder, restrictTorch]) {
                if(await func(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, world_block_rotate, replaceBlock, actions, orientation)) {
                    return actions;
                }
            }
            // Rotate block one of 8 poses
            if(mat_block.tags.includes('rotate_x8')) {
                if(new_item.rotate.y != 0) {
                    new_item.rotate.x = Math.round(player.rotate.z / 45) * 45;
                }
            }
            // Rotate block one of 16 poses
            if(mat_block.tags.includes('rotate_x16')) {
                if(new_item.rotate.y != 0) {
                    new_item.rotate.x = player.rotate.z / 90;
                }
            }
            // Auto open edit window if sign
            if(mat_block.style == 'sign') {
                actions.open_window = {
                    id: 'frmEditSign',
                    args: {pos: new Vector(pos)}
                };
            }
            // Pre place
            for(let func of [prePlaceRail]) {
                if(func(world, pos, new_item, actions)) {
                    return actions;
                }
            }
            //
            if(setActionBlock(actions, world, new Vector(pos), new_item.rotate, mat_block, new_item)) {
                if(mat_block.sound) {
                    actions.addPlaySound({tag: mat_block.sound, action: 'place', pos: new Vector(pos), except_players: [player.session.user_id]});
                }
                actions.decrement = true;
                actions.ignore_creative_game_mode = !!current_inventory_item.entity_id;
            }
        }

        return actions;
    }

}

//
function calcBlockOrientation(mat_block, rotate, n) {
    let resp = null;
    const can_set_on_wall = mat_block.tags.includes('can_set_on_wall');
    if(mat_block.tags.includes('rotate_by_pos_n')) {
        resp = calcRotateByPosN(rotate, n);
        if(mat_block.tags.includes('rotate_by_pos_n_xyz')) {
            if(resp.y) resp.set(0, 1, 0);
            if(resp.x == 18) resp.set(7, 0, 0);
            if(resp.x == 22) resp.set(13, 0, 0);
        }
    } else {
        resp = calcRotate(rotate, n, can_set_on_wall);
    }
    return resp;
};

// Set action block
function setActionBlock(actions, world, pos, orientation, mat_block, new_item) {
    const pushed_blocks = [];
    const pushed_poses = new VectorCollector();
    const pushBlock = (params) => {
        if(pushed_poses.has(params.pos)) {
            return false;
        }
        const optimizePushedItem = (item) => {
            if('extra_data' in item && !item.extra_data) {
                delete(item.extra_data);
            }
            if('rotate' in item) {
                const block = BLOCK.fromId(item.id);
                if(!block.can_rotate) {
                    delete(item.rotate);
                }
            }
        };
        optimizePushedItem(params.item);
        pushed_blocks.push(params);
        pushed_poses.set(params.pos, true);
        const block = BLOCK.fromId(params.item.id);
        if(block.next_part) {
            // Если этот блок имеет "пару"
            const next_params = JSON.parse(JSON.stringify(params));
            next_params.item.id = block.next_part.id;
            optimizePushedItem(next_params.item);
            next_params.pos = new Vector(next_params.pos).add(block.next_part.offset_pos);
            pushBlock(next_params);
        }
    };
    //
    pushBlock({pos: new Vector(pos), item: new_item, action_id: ServerClient.BLOCK_ACTION_CREATE});
    // Установить головной блок, если устанавливаемый блок двух-блочный
    if(mat_block.has_head) {
        // const new_rotate = orientation.add(new Vector(2, 0, 0));
        const new_rotate = orientation.clone();
        const next_block = {
            pos: pos.clone().addByCardinalDirectionSelf(mat_block.has_head.pos, orientation.x + 2),
            item: {
                id: mat_block.id,
                rotate: new_rotate,
                extra_data: {...new_item.extra_data, is_head: true}
            },
            action_id: ServerClient.BLOCK_ACTION_CREATE
        };
        pushBlock(next_block);
    }
    // Проверяем, что все блоки можем установить
    for(let pb of pushed_blocks) {
        const pb_block = world.getBlock(pb.pos);
        // Если блок не заменяемый, то ничего не устанавливаем вообще
        if(!BLOCK.canReplace(pb_block.id, pb_block.extra_data, mat_block.id)) {
            actions.error = 'error_block_cannot_be_replace';
            return false;
        }
        // Если блок заменяемый, то проверяем и удаляем его пару (при наличии)
        if(pb_block.material.has_head) {
            const connected_pos = new Vector(pb.pos);
            const head_pos = new Vector(pb_block.material.has_head.pos);
            if(head_pos.z) {
                connected_pos.addByCardinalDirectionSelf(head_pos, pb_block.rotate.x + 2);
            } else {
                if(pb_block.extra_data?.is_head) {
                    head_pos.multiplyScalar(-1);
                }
                connected_pos.addSelf(head_pos);
            }
            const connected_block = world.getBlock(connected_pos);
            if(connected_block.id == pb_block.id) {
                // если это не один из установленныъ только что блоков
                if(!pushed_poses.has(connected_pos)) {
                    // затираем блок-пару
                    const clear_block = {
                        pos: connected_pos,
                        item: {id: 0},
                        action_id: ServerClient.BLOCK_ACTION_CREATE
                    };
                    pushBlock(clear_block);
                }
            }
        }
    }
    // Add blocks to actions
    for(let pb of pushed_blocks) {
        actions.addBlocks([pb]);
    }
    return true;
}

// Если ткнули на предмет с собственным окном
async function needOpenWindow(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(!world_material.has_window || e.shiftKey) {
        return false;
    }
    // if is chest
    if(world_material.is_chest) {
        const entity_id = world_block ? world_block.entity_id : null;
        actions.load_chest = {
            block_id:   world_material.id,
            window:     world_material.window,
            pos:        new Vector(pos),
            entity_id:  entity_id
        };
    } else {
        switch(world_material.id) {
            case BLOCK.CRAFTING_TABLE.id: {
                actions.open_window = world_material.window;
                break;
            }
            case BLOCK.FURNACE.id: {
                actions.open_window = world_material.window;
                break;
            }
            case BLOCK.BREWING_STAND.id: {
                actions.open_window = world_material.window;
                break;
            }
            case BLOCK.CHARGING_STATION.id: {
                actions.open_window = world_material.window;
                break;
            }
            case BLOCK.ANVIL.id: {
                actions.open_window = world_material.window;
                break;
            }
            case BLOCK.LECTERN.id: {
                if(extra_data && extra_data.book) {
                    actions.open_window = {
                        id: 'frmBook',
                        args: {
                            pos: new Vector(pos),
                            extra_data: extra_data
                        }
                    };
                }
                break;
            }
            case BLOCK.BEACON.id: {
                actions.open_window = {
                    id: 'frmBeacon',
                    args: {
                        pos: new Vector(pos),
                        extra_data: extra_data
                    }
                };
                break;
            }
        }
    }
    actions.reset_mouse_actions = true;
    return true;
}

// Получение яиц из гнезда
async function getEggs(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(!world_block || world_block.id != BLOCK.CHICKEN_NEST.id || extra_data.eggs == 0) {
        return false;
    }
    actions.increment = {id: BLOCK.EGG.id, count: extra_data.eggs};
    actions.addBlocks([{pos: new Vector(pos), item: {id: BLOCK.CHICKEN_NEST.id, extra_data: {eggs: 0}}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
    return true;
}

// Put into pot
async function putIntoPot(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    const item_frame = world_material && world_material.tags.includes('item_frame');
    extra_data = extra_data ? extra_data : {};
    // rotate item in frame
    if(item_frame && extra_data?.item) {
        if(!('rot' in extra_data)) {
            extra_data.rot = 0;
        }
        extra_data.rot = (extra_data.rot + 1) % 8;
        actions.addBlocks([{pos: new Vector(pos), item: {id: world_block.id, rotate: rotate, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
        actions.addPlaySound({tag: 'madcraft:block.cloth', action: 'hit', pos: new Vector(pos), except_players: [player.session.user_id]});
        return true;
    }
    //
    const putIntoPot = !e.shiftKey && world_material &&
                        (world_material.tags.includes('pot')) &&
                        (
                            item_frame ||
                            mat_block.planting ||
                            mat_block.tags.includes('can_put_info_pot')
                        );
    if(!putIntoPot) {
        return false;
    }
    extra_data.item = {
        id: current_inventory_item.id
    };
    // copy item fields
    for(let field of ['extra_data', 'entity_id', 'power']) {
        const field_value = current_inventory_item[field];
        if(field_value) {
            extra_data.item[field] = field_value;
        }
    }
    extra_data.rot = 0;
    actions.addBlocks([{pos: new Vector(pos), item: {id: world_block.id, rotate: rotate, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
    actions.decrement_extended = {
        mode: 'count',
        ignore_creative_game_mode: true
    };
    actions.addPlaySound({tag: 'madcraft:block.cloth', action: 'hit', pos: new Vector(pos), except_players: [player.session.user_id]});
    return true;
}

// Put disc into Jukebox
async function putDiscIntoJukebox(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(mat_block.item && mat_block.item && mat_block.item.name == 'music_disc') {
        if(!e.shiftKey && world_material.tags.includes('jukebox')) {
            const discs = await Resources.loadMusicDiscs();
            for(let disc of discs) {
                if(disc.id == mat_block.id) {
                    extra_data = {
                        disc: {...disc},
                        dt: +new Date()
                    }
                    actions.addBlocks([{
                        pos: new Vector(pos),
                        item: {id: world_material.id, rotate: rotate, extra_data: extra_data},
                        action_id: ServerClient.BLOCK_ACTION_MODIFY
                    }]);
                    actions.decrement = true;
                }
            }
        }
        return true;
    }
    return false;
}

// Drop egg
async function chSpawnmob(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(!BLOCK.isSpawnEgg(mat_block.id)) {
        return false;
    }
    if(world_material.id == BLOCK.MOB_SPAWN.id) {
        extra_data.type = mat_block.spawn_egg.type;
        extra_data.skin = mat_block.spawn_egg.skin;
        extra_data.max_ticks = 800;
        actions.addBlocks([{pos: new Vector(pos), item: {id: BLOCK.MOB_SPAWN.id, rotate: rotate, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_REPLACE}]);
        actions.decrement = true;
        return true;
    }
    pos.x += pos.n.x + .5
    pos.y += pos.n.y;
    pos.z += pos.n.z + .5;
    actions.chat_message = {text: `/spawnmob ${pos.x} ${pos.y} ${pos.z} ${mat_block.spawn_egg.type} ${mat_block.spawn_egg.skin}`};
    actions.decrement = true;
    return true;
}

// Put in bucket
async function putInBucket(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(!mat_block || mat_block.id != BLOCK.BUCKET.id) {
        return false;
    }
    let added_to_bucket = false;
    if(world_material.put_in_bucket) {
        // get filled bucket
        const filled_bucket = BLOCK.fromName(world_material.put_in_bucket);
        if(filled_bucket) {
            const item = {
                id: filled_bucket.id,
                count: 1
            };
            if(world_material.extra_data) {
                item.extra_data = world_material.extra_data;
            }
            // put in bucket
            actions.putInBucket(item);
            // destroy world block
            actions.addBlocks([{pos: new Vector(pos), item: {id: BLOCK.AIR.id}, destroy_block_id: world_material.id, action_id: ServerClient.BLOCK_ACTION_DESTROY}]);
            added_to_bucket = true;
        }
    } else if (pos.fluidLeftTop) {
        // const fluidPos = new Vector().copyFrom(pos).add(pos.n);
        // const fluidVal = world.getBlock(fluidPos).fluidSource;
        const fluidType = pos.fluidVal & FLUID_TYPE_MASK;
        if(fluidType > 0) {
            if(fluidType === FLUID_WATER_ID) {
                actions.addFluids([0, 0, 0, 0], pos.fluidLeftTop);
                const filled_bucket = BLOCK.fromName("WATER_BUCKET");
                const item = {
                    id: filled_bucket.id,
                    count: 1
                };
                actions.putInBucket(item);
                added_to_bucket = true;
            }
            if(fluidType === FLUID_LAVA_ID) {
                actions.addFluids([0, 0, 0, 0], e.fluidLeftTop);
                const filled_bucket = BLOCK.fromName("LAVA_BUCKET");
                const item = {
                    id: filled_bucket.id,
                    count: 1
                };
                actions.putInBucket(item);
                added_to_bucket = true;
            }
        }
    }
    // if has sound
    if(added_to_bucket && world_material.sound) {
        actions.addPlaySound({tag: world_material.sound, action: 'place', pos: new Vector(pos), except_players: [player.session.user_id]});
    }
    return added_to_bucket;
}

// Eject disc from Jukebox
async function ejectJukeboxDisc(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(e.shiftKey || !world_material.is_jukebox) {
        return false;
    }
    if(!extra_data || !('disc' in extra_data)) {
        return false;
    }
    const disc_id = extra_data.disc.id;
    pos = new Vector(pos);
    // Drop disc
    dropBlock(player, new FakeTBlock(disc_id, null, new Vector(pos), null, null, null, null, null, null), actions, false);
    actions.addBlocks([{pos: pos.clone(), item: {id: world_material.id, rotate: rotate, extra_data: null}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
    actions.stop_disc.push({pos: pos.clone()});
    return true;
}

// Press to button
async function pressToButton(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    // Buttons
    if(e.shiftKey || !world_material.is_button) {
        return false;
    }
    extra_data = extra_data || {}
    extra_data.pressed = !extra_data.pressed ? 1 : 0;
    if(extra_data && 'pressed' in extra_data) {
        pos = new Vector(pos);
        actions.addBlocks([{pos: pos, item: {id: world_material.id, rotate: rotate, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
        actions.addPlaySound({tag: 'madcraft:block.player', action: 'click', pos: new Vector(pos), except_players: [player.session.user_id]});
        actions.reset_mouse_actions = true;
        return true;
    }
    return false;
}

/**
 * Sit down
 * @param {*} e 
 * @param {*} world 
 * @param {Vector} pos 
 * @param {*} player 
 * @param {*} world_block 
 * @param {*} world_material 
 * @param {*} mat_block 
 * @param {*} current_inventory_item 
 * @param {*} extra_data 
 * @param {Vector} rotate 
 * @param {*} replace_block 
 * @param {WorldAction} actions 
 * @returns 
 */
async function sitDown(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(e.shiftKey) {
        return false;
    }
    if(mat_block && mat_block.tags.includes('wool')) {
        return false;
    }
    const world_block_is_slab = world_material.layering && world_material.height == 0.5;
    const is_stool = world_material.style == 'stool';
    const is_chair = world_material.style == 'chair';
    const block_for_sittings = (world_material.tags.includes('stairs')) || world_block_is_slab || is_chair || is_stool;
    if(!block_for_sittings || (mat_block && !is_chair && !is_stool)) {
        return false;
    }
    const is_head = world_material?.has_head && world_block.extra_data.is_head;
    // check over block if not empty for head
    const overBlock = world.getBlock(new Vector(pos.x, pos.y + (is_head ? 1 : 2), pos.z));
    if(overBlock && !overBlock.material.transparent) {
        return false;
    }
    //
    const sit_height = (is_chair || is_stool) ? 11/16 : 1/2;
    const sit_pos = new Vector(
        pos.x + .5,
        pos.y + sit_height - (is_head ? 1 : 0),
        pos.z + .5
    )
    // if slab on ceil
    if(world_block_is_slab) {
        const on_ceil = world_block.extra_data?.point?.y >= .5;
        if(on_ceil) sit_pos.y += .5;
    }
    //
    if(is_chair || is_stool || player.pos.distance(sit_pos) < 3.0) {
        actions.reset_mouse_actions = true;
        actions.setSitting(
            sit_pos,
            new Vector(0, 0, rotate ? (rotate.x / 4) * -(2 * Math.PI) : 0)
        )
        return true;
    }
    return false;
}

// Нельзя ничего ставить поверх этого блока
async function noSetOnTop(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    const noSetOnTop = world_material.tags.includes('no_set_on_top');
    return noSetOnTop && pos.n.y == 1;
}

// Edit sign
async function editSign(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    const isEditSign = e.changeExtraData && world_material && world_material.tags.includes('sign');
    if(!isEditSign) {
        return false;
    }
    if(e?.extra_data?.text) {
        if(!extra_data) {
            extra_data = {
                text: null
            };
        }
        extra_data.text = e?.extra_data?.text || '';
        if(typeof extra_data.text == 'string') {
            if(extra_data.text.length <= 110) {
                var date = new Date();
                extra_data.username = player.username;
                extra_data.dt = date.toISOString();
                actions.addBlocks([{pos: new Vector(pos), item: {id: world_material.id, rotate: rotate, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
            }
        }
    }
    return true;
}

// Go to bed
async function goToBed(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    const goToBed = !e.shiftKey && world_material && (world_material.tags.includes('bed'));
    if(!goToBed) {
        return false;
    }
    actions.error = 'error_no_time_to_sleep';
    return true;
}

// Eat cake
function eatCake(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    const eatCake = !e.shiftKey && world_material && (world_material.tags.includes('cake'));
    if(!eatCake) {
        return false;
    }
    if(!extra_data || typeof extra_data.pieces == 'undefined') {
        extra_data = {...world_material.extra_data};
    }
    if(extra_data?.pieces) {
        extra_data.pieces--;
        if(extra_data.pieces == 0) {
            actions.addBlocks([{pos: new Vector(pos), item: {id: BLOCK.AIR.id}, destroy_block_id: world_material.id, action_id: ServerClient.BLOCK_ACTION_DESTROY}]);
            actions.addPlaySound({tag: 'madcraft:block.player', action: 'burp', pos: new Vector(pos), except_players: [player.session.user_id]});
        } else {
            actions.addBlocks([{pos: new Vector(pos), item: {id: world_material.id, rotate: rotate, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
            actions.reset_mouse_actions = true;
            actions.addPlaySound({tag: 'madcraft:block.player', action: 'eat', pos: new Vector(pos), except_players: [player.session.user_id]});
        }
    }
    return true;
}

// удаление портала
async function deletePortal(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {

    // get frame material
    let portal_frame_block_name = null;
    if(world_material) {
        const type = WorldPortal.getPortalTypeForFrame(world_material);
        if(type) {
            portal_frame_block_name = type.block_name;
        }
    }

    if (!world_material || (world_material.id != BLOCK.NETHER_PORTAL.id && world_material.name != portal_frame_block_name)) {
        return;
    }

    const poses = [];

    // проверка есть ли позиция в массиве
    const isAdded = (pos) => {
        for(let el of poses) {
            if (el.x == pos.x && el.y == pos.y && el.z == pos.z) {
                return true;
            }
        }
        return false;
    }

    const portal_ids = new Map();

    // рекурсивный поиск блоков NETHER_PORTAL
    const findNeighbours = (pos) => {
        const neighbours = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
        for(let el of neighbours) {
            const position = pos.offset(el[0], el[1], el[2]);
            const tblock = world.getBlock(position);
            if(tblock && tblock.material.is_portal) {
                if(!isAdded(position)) {
                    if(tblock.extra_data && tblock.extra_data.id) {
                        const portal_id = tblock.extra_data.id;
                        portal_ids.set(portal_id, portal_id);
                    }
                    poses.push(position);
                    findNeighbours(position);
                }
            }
        }
    }

    findNeighbours(new Vector(pos.x, pos.y, pos.z));

    if(poses.length > 0) {
        const arr = [];
        for(let el of poses) {
            arr.push({
                pos: el,
                item: {
                    id: BLOCK.AIR.id
                },
                action_id: ServerClient.BLOCK_ACTION_MODIFY
            });
        }
        actions.addBlocks(arr);
        //
        if(portal_ids.size > 0 && Qubatch.is_server) {
            for(let portal_id of Array.from(portal_ids.keys())) {
                console.log('delete portal ', portal_id);
                world.db.portal.delete(player, portal_id);
            }
        }
    }

}

async function useFlintAndSteel(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {

    if (!world_material || !current_inventory_item || (current_inventory_item.id != BLOCK.FLINT_AND_STEEL.id)) {
        return false;
    }

    const position = new Vector(pos);
    position.addSelf(pos.n);

    actions.addPlaySound({tag: 'madcraft:fire', action: 'flint_and_steel_click', pos: position, except_players: [player.session.user_id]});

    // Если материл используется для портала и игрок в биоме
    const portal_type = WorldPortal.getPortalTypeForFrame(world_material);
    if (portal_type && world.info.generator.rules.portals) {
        const frame_block_id = world_material.id;
        // находим растояние до стенки
        const getDistanceEdge = (pos, dir) => {
            for (let i = 0; i < MAX_SIZE_PORTAL; i++) {
                let blockpos = new Vector(pos.x + i, pos.y, pos.z);
                switch(dir) {
                    case DIRECTION.WEST:
                        blockpos = new Vector(pos.x - i, pos.y, pos.z);
                        break;
                    case DIRECTION.NORTH:
                        blockpos = new Vector(pos.x, pos.y, pos.z + i);
                        break;
                    case DIRECTION.SOUTH:
                        blockpos = new Vector(pos.x, pos.y, pos.z - i);
                        break;
                }
                if (world.getBlock(blockpos).id != BLOCK.AIR.id || world.getBlock(blockpos.add(Vector.YN)).id != frame_block_id) {
                    return world.getBlock(blockpos).id == frame_block_id ? i : 0;
                }
            }
            return 0;
        }
        // размер окна
        let width = 0;
        let height = 0;
        let bottom_left;
        let left_dir = DIRECTION.WEST;
        let right_dir = DIRECTION.EAST;
        const nullpos = position.clone();

        do {
            nullpos.addSelf(Vector.YN);
        } while(world.getBlock(nullpos).id == BLOCK.AIR.id);
        nullpos.addSelf(Vector.YP);

        if (getDistanceEdge(nullpos, DIRECTION.EAST) == 0) {
            left_dir = DIRECTION.SOUTH;
            right_dir = DIRECTION.NORTH;
        }

        if (nullpos) {
            // находим ширину
            const dist = getDistanceEdge(nullpos, left_dir) - 1;
            if (dist >= 0) {
                bottom_left = (left_dir == DIRECTION.WEST) ? nullpos.offset(-dist, 0, 0) : nullpos.offset(0, 0, -dist);
                width = getDistanceEdge(bottom_left, right_dir);
                if (width < 2 || width > MAX_SIZE_PORTAL) {
                    width = 0;
                }
            }

            // находим высоту
            if (width != 0) {
                rep:
                for (height = 0; height < MAX_SIZE_PORTAL; ++height) {
                    for (let i = -1; i <= width; ++i) {
                        const blockpos = (right_dir == DIRECTION.EAST) ? bottom_left.offset(i, height, 0) : bottom_left.offset(0, height, i);
                        const block = world.getBlock(blockpos);
                        if (i == -1) {
                            if (block.id != frame_block_id) {
                                break rep;
                            }
                        } else if (i == width) {
                            if (block.id != frame_block_id) {
                                break rep;
                            }
                        } else {
                            if (block.id != BLOCK.AIR.id) {
                                break rep;
                            }
                        }
                    }
                }

                // проверям перекладину
                for (let j = 0; j < width; ++j) {
                    let blockpos = (right_dir == DIRECTION.EAST) ? bottom_left.offset(j, height, 0) : bottom_left.offset(0, height, j);
                    let block = world.getBlock(blockpos);
                    if (block.id != frame_block_id) {
                        height = 0;
                        break;
                    }
                }

                if(height > 2) {
                    // Блок портала
                    const portal_block = {
                        id: BLOCK.NETHER_PORTAL.id,
                        rotate: new Vector(
                            (right_dir == DIRECTION.EAST) ? DIRECTION.SOUTH : DIRECTION.EAST,
                            1,
                            0
                        )
                    };
                    // Сохраняем портал в БД
                    const portal = {
                        pos:                bottom_left.clone(),
                        rotate:             portal_block.rotate.clone(),
                        size:               {width: width + 2, height: height + 2},
                        player_pos:         bottom_left.clone(),
                        pair_pos:           null,
                        portal_block_id:    portal_block.id,
                        type:               portal_type.id
                    };
                    //
                    if(right_dir == DIRECTION.EAST) {
                        portal.player_pos.addScalarSelf(width / 2, 1, .5);
                    } else {
                        portal.player_pos.addScalarSelf(.5, 1, width / 2);
                    }
                    // check restricts
                    let restricted = false;
                    for(let restrict of portal_type.open_restricts) {
                        restricted = true;
                        for(let k in restrict) {
                            if(k == 'ymore' && !(portal.player_pos.y >= restrict[k])) restricted = false;
                            if(k == 'yless' && !(portal.player_pos.y <= restrict[k])) restricted = false;
                        }
                        if(restricted) break;
                    }
                    if(restricted) {
                        throw 'error_portal_restricted_place';
                    }
                    //
                    if(Qubatch.is_server) {
                        portal_block.extra_data = {
                            id: await world.db.portal.add(player.session.user_id, portal),
                            type: portal_type.id
                        };
                    } else {
                        portal_block.extra_data = {
                            id: null,
                            type: portal_type.id
                        };
                    }
                    // Заполняем окно
                    const arr = [];
                    for(let i = 0; i < height; i++) {
                        for(let j = 0; j < width; j++) {
                            arr.push(
                            {
                                pos: (right_dir == DIRECTION.EAST) ? bottom_left.offset(j, i, 0) : bottom_left.offset(0, i, j),
                                item: portal_block,
                                action_id: ServerClient.BLOCK_ACTION_CREATE
                            });
                        }
                    }
                    actions.addBlocks(arr);
                    return true;
                }
            }
        }
    }

    // детонатация tnt
    if (!e.shiftKey && world_block.id == BLOCK.TNT.id) {
        actions.addPlaySound({tag: 'madcraft:block.player', action: 'fuse', pos: new Vector(pos), except_players: [player.session.user_id]});
        actions.addBlocks([{pos: new Vector(pos), item: {id: BLOCK.TNT.id, extra_data:{explode: true, fuse: 0}}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
        return true;
    }

    // поджигаем блок
    const air_block = world.getBlock(position);
    if (pos.n.y != -1 && air_block.id == BLOCK.AIR.id && air_block.fluid == 0) {
        const data = {age: 0};
        let block = world.getBlock(position.offset(1, 0, 0));
        data.east = (block?.material?.flammable) ? true : false;
        block = world.getBlock(position.offset(-1, 0, 0));
        data.west = (block?.material?.flammable) ? true : false;
        block = world.getBlock(position.offset(0, 0, 1));
        data.north = (block?.material?.flammable) ? true : false;
        block = world.getBlock(position.offset(0, 0, -1));
        data.south = (block?.material?.flammable) ? true : false;
        block = world.getBlock(position.offset(0, -1, 0));
        data.up = (block.id != BLOCK.AIR.id && block.id != BLOCK.FIRE.id) ? true : false;
        actions.addBlocks([{pos: position, item: {id: BLOCK.FIRE.id, extra_data: data}, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
        return true;
    }

    return false;

}

// добавление ламинарии вручную
async function putKelp(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if (!world_material || !mat_block || mat_block.id != BLOCK.KELP.id)  {
        return false;
    }
    const position = new Vector(pos.x, pos.y + 1, pos.z);
    let block = world.getBlock(position);
    // проверка, что уствновка в воде
    if (!block || (block.fluid & FLUID_TYPE_MASK) == FLUID_WATER_ID) {
        block = world.getBlock(position.offset(0, -1, 0));
        // проверка, что уствнавливаем на kelp
        if (block.id == BLOCK.KELP.id) {
            actions.addBlocks([{pos: position, item: {id: BLOCK.KELP.id, extra_data: {notick: true} }, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
        }
        // @todo работает, но криво
        /*if([BLOCK.DIRT.id, BLOCK.SAND.id, BLOCK.GRAVEL.id].includes(block.id)) {
            actions.addBlocks([{pos: position, item: {id: BLOCK.KELP.id, extra_data: mat_block.extra_data, ticking:mat_block.ticking }, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
        }*/
    }
    return false;
}

//
async function putPlate(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if (!world_material || !mat_block || mat_block.style != 'cover') {
        return false;
    }
    const orientation = calcBlockOrientation(mat_block, player.rotate, pos.n);
    const position = new Vector(pos.x, pos.y, pos.z)
    position.addSelf(pos.n);
    const block = world.getBlock(position);
    if (block && block.id == mat_block.id) {
        // fix old vines
        if(!block.extra_data) {
            if(block.material && block.material.tags.includes('vines')) {
                block.extra_data = JSON.parse(JSON.stringify(block.material.extra_data));
                if(block.rotate) {
                    switch(block.rotate.x) {
                        case DIRECTION.SOUTH: block.extra_data.south = true; break;
                        case DIRECTION.NORTH: block.extra_data.north = true; break;
                        case DIRECTION.WEST: block.extra_data.west = true; break;
                        case DIRECTION.EAST: block.extra_data.east = true; break;
                    }
                }
            }
        }
        // поворот
        if (pos.n.y != 0) {
            block.extra_data.rotate = (orientation.x == DIRECTION.WEST || orientation.x == DIRECTION.EAST) ? true : false;
        }
        if (pos.n.y == 1) {
            block.extra_data.up = true;
        }
        if (pos.n.y == -1) {
            block.extra_data.down = true;
        }
        if (pos.n.x == -1) {
            block.extra_data.west = true;
        }
        if (pos.n.x == 1) {
            block.extra_data.east = true;
        }
        if (pos.n.z == -1) {
            block.extra_data.south = true;
        }
        if (pos.n.z == 1) {
            block.extra_data.north = true;
        }
        actions.decrement = true;
        actions.addBlocks([{pos: block.posworld, item: {id: block.id, extra_data: block.extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
    } else if (world_block.id != mat_block.id){
        const data = {};
        if (pos.n.y == 1) {
            data.up = true;
        }
        if (pos.n.y == -1) {
            data.down = true;
        }
        if (pos.n.x == -1) {
            data.west = true;
        }
        if (pos.n.x == 1) {
            data.east = true;
        }
        if (pos.n.z == -1) {
            data.south = true;
        }
        if (pos.n.z == 1) {
            data.north = true;
        }
        data.rotate = (orientation.x == DIRECTION.WEST || orientation.x == DIRECTION.EAST) ? true : false;
        actions.decrement = true;
        actions.addBlocks([{pos: position, item: {id: mat_block.id, extra_data: data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
    }
    return true;
}

// Open fence gate
async function openFenceGate(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if (!world_material || world_material.style != 'fence_gate') {
        return false;
    }
    if(!extra_data) {
        extra_data = {};
    }
    if (rotate.x == 0 || rotate.x == 2) {
        extra_data.facing = (pos.z - player.pos.z) > 0 ? 'east' : 'west';
    } else {
        extra_data.facing = (pos.x - player.pos.x) > 0 ? 'north' : 'south';
    }
    extra_data.opened = extra_data && !extra_data.opened;
    if(world_material.sound) {
        actions.addPlaySound({tag: world_material.sound, action: 'open', pos: new Vector(pos), except_players: [player.session.user_id]});
    }
    actions.addBlocks([{pos: new Vector(pos), item: {id: world_material.id, rotate: rotate, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
    return true;
}

// Open door
async function openDoor(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    const isEditDoor = !e.shiftKey && world_material &&
        (world_material.tags.includes('trapdoor') || world_material.tags.includes('door'));
    if(!isEditDoor) {
        return false;
    }
    // Trapdoor
    if(!extra_data) {
        extra_data = {
            opened: false,
            point: new Vector(0, 0, 0)
        };
    }
    extra_data.opened = extra_data && !extra_data.opened;
    if(world_material.sound) {
        actions.addPlaySound({tag: world_material.sound, action: 'open', pos: new Vector(pos), except_players: [player.session.user_id]});
    }
    actions.reset_mouse_actions = true;
    actions.addBlocks([{pos: new Vector(pos), item: {id: world_material.id, rotate: rotate, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
    // Если блок имеет пару (двери)
    if(world_material.has_head) {
        const head_pos = new Vector(world_material.has_head.pos);
        if(extra_data.is_head) {
            head_pos.multiplyScalar(-1);
        }
        const connected_pos = new Vector(pos).addSelf(head_pos);
        const block_connected = world.getBlock(connected_pos);
        if(block_connected.id == world_material.id) {
            block_connected.extra_data.opened = extra_data.opened;
            actions.addBlocks([{pos: connected_pos, item: {id: block_connected.id, rotate: rotate, extra_data: block_connected.extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
        }
    }
    return true;
}

// Remove plant from pot
async function removeFromPot(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(world_material && world_material.tags.includes('pot')) {
        if(extra_data?.item) {
            extra_data = extra_data ? extra_data : {};
            const drop_item = extra_data?.item;
            drop_item.count = 1;
            delete(extra_data.item);
            actions.addBlocks([{pos: new Vector(pos), item: {id: world_block.id, rotate: rotate, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
            actions.addPlaySound({tag: 'madcraft:block.cloth', action: 'hit', pos: new Vector(pos), except_players: [player.session.user_id]});
            // Create drop item
            actions.addDropItem({pos: world_block.posworld.add(new Vector(.5, 0, .5)), items: [drop_item], force: true});
            return true;
        }
    }
    return false;
}

// Посадить растения можно только на блок земли
async function restrictPlanting(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions, orientation) {
    if(!mat_block.planting) {
        return false;
    }
    const underBlock = world.getBlock(new Vector(pos.x, pos.y - 1, pos.z));
    if(!underBlock) {
        return true;
    }
    // водное растение
    if (mat_block.tags.includes('in_water_plant')) {
        const block = world.getBlock(new Vector(pos));
        if (!block || (block.fluid & FLUID_TYPE_MASK) != FLUID_WATER_ID) {
            return true
        }
        if(![BLOCK.DIRT.id, BLOCK.SAND.id, BLOCK.GRAVEL.id, BLOCK.GRASS_BLOCK.id].includes(underBlock.id)) {
            return true;
        }
        return false;
    }
    if(![BLOCK.GRASS_BLOCK.id, BLOCK.FARMLAND.id, BLOCK.FARMLAND_WET.id].includes(underBlock.id)) {
        return true;
    }
    // Посадить семена можно только на вспаханную землю
    if(mat_block.seeds && ![BLOCK.FARMLAND.id, BLOCK.FARMLAND_WET.id].includes(underBlock.id)) {
        return true;
    }
    return false;
}

//
async function setOnWater(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(!mat_block || !mat_block.tags.includes('set_on_water')) {
        return false;
    }
    if(world_block.isWater) {
        const position = new Vector(pos);
        position.addSelf(pos.n);
        const block_air = world.getBlock(position.add(pos.n));
        if (block_air.id == BLOCK.AIR.id && block_air.fluid === 0) {
            actions.addBlocks([{
                pos: position,
                item: {
                    id: mat_block.id
                },
                action_id: ServerClient.BLOCK_ACTION_CREATE
            }]);
        }
    }
    return true;
}

// Можно поставить только на полный (непрозрачный блок, снизу)
async function restrictOnlyFullFace(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions, orientation) {
    if(mat_block.tags.includes('set_only_fullface')) {
        const underBlock = world.getBlock(new Vector(pos.x, pos.y - 1, pos.z));
        if(!underBlock || underBlock.material.transparent) {
            return true;
        }
    }
    return false;
}

// Проверка места под лестницу/лианы
async function restrictLadder(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions, orientation) {
    if(['ladder'].indexOf(mat_block.style) < 0) {
        return false;
    }
    // Лианы можно ставить на блоки с прозрачностью
    if(world_material.transparent && world_material.style != 'default') {
        return true;
    }
    //
    if(pos.n.y != 0) {
        let cardinal_direction = orientation.x;
        let ok = false;
        for(let i = 0; i < 4; i++) {
            let pos2 = new Vector(pos.x, pos.y, pos.z);
            let cd = cardinal_direction + i;
            if(cd > 4) cd -= 4;
            // F R B L
            switch(cd) {
                case ROTATE.S: {
                    pos2 = pos2.add(new Vector(0, 0, 1));
                    break;
                }
                case ROTATE.W: {
                    pos2 = pos2.add(new Vector(1, 0, 0));
                    break;
                }
                case ROTATE.N: {
                    pos2 = pos2.add(new Vector(0, 0, -1));
                    break;
                }
                case ROTATE.E: {
                    pos2 = pos2.add(new Vector(-1, 0, 0));
                    break;
                }
            }
            const cardinal_block = world.getBlock(pos2);
            if(cardinal_block.transparent && !(mat_block.tags.includes('anycardinal'))) {
                cardinal_direction = cd;
                ok = true;
                break;
            }
        }
        if(!ok) {
            return true;
        }
    }
    return false;
}

// Факелы можно ставить только на определенные виды блоков!
async function restrictTorch(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions, orientation) {
    if(mat_block.style != 'torch') {
        return false;
    }
    return !replace_block && (
        (pos.n.y < 0) ||
        (world_material.width && world_material.width != 1) ||
        (world_material.height && world_material.height != 1) ||
        ['default', 'fence', 'wall'].indexOf(world_material.style) < 0 ||
        (['fence', 'wall'].indexOf(world_material.style) >= 0 && pos.n.y != 1)
    );
}

// use shears
async function useShears(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(current_inventory_item.id != BLOCK.SHEARS.id || extra_data?.sheared) {
        return false;
    }
    const position = new Vector(pos);
    if (world_material.tags.includes('leaves')) {
        actions.addBlocks([{pos: position, item: {id: world_material.id, extra_data: { sheared: true }}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
        actions.decrement_instrument = {id: current_inventory_item.id};
    }
    return false;
}

//
async function useTorch(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(!mat_block || mat_block.style != 'torch') {
        return false;
    }
    if(world_material.name == 'CAMPFIRE' || world_material.style == 'candle') {
        extra_data = extra_data || {};
        extra_data.active = true;
        actions.addBlocks([{pos: world_block.posworld.clone(), item: {id: world_material.id, rotate: rotate, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
        return true;
    }
    return false;
}

//
async function useShovel(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(mat_block.item.name != 'instrument' || mat_block.item.instrument_id != 'shovel') {
        return false;
    }
    if(world_material.id == BLOCK.GRASS_BLOCK.id || world_material.id == BLOCK.DIRT.id) {
        const extra_data = null;
        actions.addBlocks([{pos: new Vector(pos), item: {id: BLOCK.DIRT_PATH.id, rotate: rotate, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_REPLACE}]);
        actions.decrement = true;
        if(mat_block.sound) {
            actions.addPlaySound({tag: mat_block.sound, action: 'place', pos: new Vector(pos), except_players: [player.session.user_id]});
        }
        return true;
    }
    if(world_material.name == 'CAMPFIRE') {
        extra_data.active = false;
        actions.addBlocks([{pos: world_block.posworld.clone(), item: {id: world_material.id, rotate: rotate, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
        return true;
    }
    return false;
}

//
async function useHoe(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(mat_block.item.name != 'instrument' || mat_block.item.instrument_id != 'hoe') {
        return false;
    }
    if(world_material.id == BLOCK.GRASS_BLOCK.id || world_material.id == BLOCK.DIRT_PATH.id || world_material.id == BLOCK.DIRT.id) {
        const extra_data = null;
        actions.addBlocks([{pos: new Vector(pos), item: {id: BLOCK.FARMLAND.id, rotate: rotate, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_REPLACE}]);
        actions.decrement = true;
        if(mat_block.sound) {
            actions.addPlaySound({tag: mat_block.sound, action: 'place', pos: new Vector(pos), except_players: [player.session.user_id]});
        }
        return true;
    }
    return false;
}

// Use axe for make stripped logs
async function useAxe(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(!world_material || mat_block.item.name != 'instrument' || mat_block.item.instrument_id != 'axe') {
        return false;
    }
    if(world_material.tags.includes('log') && world_material.stripped_log) {
        const stripped_block = BLOCK.fromName(world_material.stripped_log);
        if(stripped_block) {
            actions.addBlocks([{pos: new Vector(pos), item: {id: stripped_block.id, rotate: world_block.rotate, extra_data: world_block.extra_data}, action_id: ServerClient.BLOCK_ACTION_REPLACE}]);
            if(mat_block.sound) {
                actions.addPlaySound({tag: mat_block.sound, action: 'strip', pos: new Vector(pos), except_players: [player.session.user_id]});
            }
            return true;
        }
    }
    return false;
}

// Use bone meal
async function useBoneMeal(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(mat_block.item.name != 'bone_meal' || !world_material) {
        return false;
    }
    const position = new Vector(pos);
    if(world_material.id == BLOCK.GRASS_BLOCK.id) {
        const tblock_pos = new Vector(0, 0, 0);
        const tblock_pos_over = new Vector(0, 0, 0);
        const tblock_pos_over2 = new Vector(0, 0, 0);
        const grass_palette = [
            ...(new Array(64).fill(BLOCK.GRASS.id)),
            ...(new Array(16).fill(BLOCK.AIR.id)),
            ...(new Array(8).fill(BLOCK.DANDELION.id)),
            ...(new Array(2).fill(BLOCK.OXEYE_DAISY.id)),
            ...(new Array(2).fill(BLOCK.POPPY.id)),
            BLOCK.LILY_OF_THE_VALLEY.id,
            BLOCK.CORNFLOWER.id,
            BLOCK.BLUE_ORCHID.id
        ];
        const random = new alea(e.id);
        for(let x = -3; x <= 3; x++) {
            for(let y = -3; y <= 3; y++) {
                for(let z = -3; z <= 3; z++) {
                    tblock_pos.copyFrom(pos).addScalarSelf(x, y, z);
                    const tblock = world.getBlock(tblock_pos);
                    if(tblock.id == BLOCK.GRASS_BLOCK.id) {
                        tblock_pos_over.copyFrom(tblock_pos).addScalarSelf(0, 1, 0);
                        const over1 = world.getBlock(tblock_pos_over);
                        if(over1.id == BLOCK.AIR.id) {
                            let flower_id = grass_palette[(random.double() * grass_palette.length) | 0];
                            if(flower_id > 0) {
                                if(flower_id == BLOCK.GRASS.id) {
                                    if(random.double() < .1) {
                                        tblock_pos_over2.copyFrom(tblock_pos_over).addScalarSelf(0, 1, 0);
                                        const over2 = world.getBlock(tblock_pos_over2);
                                        if(over2.id == BLOCK.AIR.id) {
                                            flower_id = BLOCK.TALL_GRASS.id;
                                            actions.addBlocks([{pos: tblock_pos_over2.clone(), item: {id: flower_id, extra_data: {is_head: true}}, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
                                        }
                                    }
                                }
                                actions.addBlocks([{pos: tblock_pos_over.clone(), item: {id: flower_id}, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
                            }
                        }
                    }
                }
            }
        }
        actions.addParticles([{type: 'villager_happy', pos: position.offset(0, 1, 0), area: true}]);
        actions.decrement = true;
        if(mat_block.sound) {
            actions.addPlaySound({tag: mat_block.sound, action: 'place', pos: position, except_players: [player.session.user_id]});
        }
        return true;
    } else if (world_block?.material?.ticking?.type && extra_data) {
        if (world_block.material.ticking.type == 'stage' && !extra_data?.notick) {
            extra_data.bone = Math.random() < 0.5 ? 1 : 2;
            actions.addBlocks([{pos: position, item: {id: world_block.id, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
            actions.decrement = true;
            actions.addParticles([{type: 'villager_happy', pos: position}]);
            actions.addPlaySound({tag: mat_block.sound, action: 'place', position, except_players: [player.session.user_id]});
            return true;
        }
    }
    return false;
}

// "Наслаивание" блока друг на друга, при этом блок остается 1, но у него увеличивается высота (максимум до 1)
async function increaseLayering(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    //
    const pos_n = pos.n;
    if(pos_n.y == 0) {
        return false;
    }
    pos = new Vector(pos);
    //
    const block_touched = world.getBlock(pos);
    if((block_touched?.id == mat_block.id) && !!mat_block.is_layering) {
        // ok
    } else {
        pos.x += pos_n.x;
        pos.y += pos_n.y;
        pos.z += pos_n.z;
        const block_on_posn = world.getBlock(pos);
        if((block_on_posn?.id == mat_block.id) && !!mat_block.is_layering) {
            // pos.n.y = 1;
            extra_data = block_on_posn.extra_data;
            world_block = block_on_posn;
            world_material = block_on_posn.material;
        } else {
            return false;
        }
    }
    //
    if(!world_material.layering) {
        return false;
    }
    //
    const layering = world_material.layering;
    let new_extra_data = null;
    if(extra_data) {
        new_extra_data = JSON.parse(JSON.stringify(extra_data));
    } else {
        new_extra_data = {height: layering.height};
    }
    if(!('height' in new_extra_data)) {
        new_extra_data.height = world_material.height;
    }
    //
    if(new_extra_data.height == 1) {
        return false;
    }
    // For slabs
    if(new_extra_data.point) {
        if(pos_n.y == -1) {
            if(new_extra_data.point.y < .5) {
                return false;
            } else {
                new_extra_data.point.y = 0;
            }
        }
        //
        if(pos_n.y == 1) {
            if(new_extra_data.point.y >= .5) {
                return false;
            }
        }
    }
    //
    new_extra_data.height += layering.height;
    if(new_extra_data.height < 1) {
        // add part
        actions.addBlocks([{pos: new Vector(pos), item: {id: world_material.id, rotate: rotate, extra_data: new_extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
        actions.addPlaySound({tag: world_material.sound, action: 'place', pos: new Vector(pos), except_players: [player.session.user_id]});
    } else {
        if(layering.full_block_name) {
            // replace to full block
            const full_block = BLOCK.fromName(layering.full_block_name);
            actions.addBlocks([{pos: new Vector(pos), item: {id: full_block.id}, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
            actions.addPlaySound({tag: full_block.sound, action: 'place', pos: new Vector(pos), except_players: [player.session.user_id]});
        } else {
            actions.addBlocks([{pos: new Vector(pos), item: {id: world_material.id, rotate: rotate, extra_data: new_extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
            actions.addPlaySound({tag: world_material.sound, action: 'place', pos: new Vector(pos), except_players: [player.session.user_id]});
        }
    }
    actions.reset_mouse_actions = true;
    actions.decrement = true;
    return true;
}

// Add candle
function addCandle(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    const add = !e.shiftKey &&
                (world_material && (world_material.style == 'candle')) &&
                (current_inventory_item && current_inventory_item.id == world_material.id);
    if(!add) {
        return false;
    }
    if(!extra_data || typeof extra_data.candles == 'undefined') {
        extra_data = {candles: 1};
    }
    if(('candles' in extra_data) && extra_data.candles < 4) {
        extra_data.candles++;
        actions.addBlocks([{pos: new Vector(pos), item: {id: world_material.id, rotate: rotate, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
        actions.addPlaySound({tag: 'madcraft:block.cloth', action: 'hit', pos: new Vector(pos), except_players: [player.session.user_id]});
        actions.reset_mouse_actions = true;
        actions.decrement = true;
    }
    return true;
}

// Place rail
function prePlaceRail(world, pos, new_item, actions) {
    return RailShape.place(world, pos, new_item, actions);
}

// Set furniture upholstery
async function setFurnitureUpholstery(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(mat_block.tags.includes('wool')) {
        if(['chair', 'stool'].includes(world_material.style)) {
            if(extra_data.is_head) {
                pos = new Vector(0, -1, 0).add(pos);
                world_block = world.getBlock(pos);
                extra_data = world_block?.extra_data;
            }
            extra_data.upholstery = mat_block.name;
            actions.addBlocks([{
                pos: new Vector(pos),
                item: {id: world_material.id, rotate, extra_data},
                action_id: ServerClient.BLOCK_ACTION_MODIFY
            }]);
            actions.addPlaySound({tag: 'madcraft:block.cloth', action: 'hit', pos: new Vector(pos), except_players: [player.session.user_id]});
            return true;
        }
    }
    return false;
}

// Remove furniture upholstery
async function removeFurnitureUpholstery(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if(world_material && ['chair', 'stool'].includes(world_material.style)) {
        if(extra_data.is_head) {
            pos = new Vector(0, -1, 0).add(pos);
            world_block = world.getBlock(pos);
            extra_data = world_block?.extra_data;
            rotate = world_block.rotate;
        }
        //
        if(extra_data?.upholstery) {
            const drop_item = {
                id: BLOCK.fromName(extra_data?.upholstery).id,
                count: 1
            };
            delete(extra_data.upholstery);
            actions.addBlocks([{
                pos: new Vector(pos),
                item: {id: world_block.id, rotate, extra_data},
                action_id: ServerClient.BLOCK_ACTION_MODIFY
            }]);
            actions.addPlaySound({tag: 'madcraft:block.cloth', action: 'hit', pos: new Vector(pos), except_players: [player.session.user_id]});
            // Create drop item
            actions.addDropItem({pos: world_block.posworld.add(new Vector(.5, .5, .5)), items: [drop_item], force: true});
            return true;
        }
    }
    return false;
}