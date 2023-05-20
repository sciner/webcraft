import {ROTATE, Vector, VectorCollector, Helpers, DIRECTION, Mth,
    SpatialDeterministicRandom, ObjectHelpers, getValidPosition } from "./helpers.js";
import { AABB } from './core/AABB.js';
import {CD_ROT, CubeSym} from './core/CubeSym.js';
import { BLOCK, FakeTBlock, EXTRA_DATA_SPECIAL_FIELDS_ON_PLACEMENT, NO_DESTRUCTABLE_BLOCKS } from "./blocks.js";
import {ServerClient} from "./server_client.js";
import { Resources } from "./resources.js";
import {impl as alea} from '@vendors/alea.js';
import { RailShape } from "./block_type/rail_shape.js";
import { WorldPortal } from "./portal.js";
import {
    FLUID_LAVA_ID,
    FLUID_WATER_ID,
    FLUID_TYPE_MASK, isFluidId
} from "./fluid/FluidConst.js";
import { BLOCK_FLAG, COVER_STYLE_SIDES, DEFAULT_STYLE_NAME, VOLUMETRIC_SOUND_ANGLE_TO_SECTOR } from "./constant.js";
import type { TBlock } from "./typed_blocks3.js";
import { Lang } from "./lang.js";
import type { TSittingState, TSleepState} from "./player.js";
import { MechanismAssembler } from "./mechanism_assembler.js";

/** A type that is as used as player in actions. */
export type ActionPlayerInfo = {
    radius      : float,    // it's used as the player's diameter, not radius!
    height      : float,
    username?   : string,
    pos         : IVector,
    rotate      : IVector,
    session: {
        user_id: number
    }
}

declare type PlaySoundParams = {
    tag: string
    action: string
    pos: Vector
    // It's not used when playng the sound. TODO use it
    except_players?: number[],
    maxDist?: number
}

type DropItemParams = {
    pos     : Vector
    items   : IBlockItem[]
    force ? : boolean
}

export type ActivateMobParams = {
    id          : int
    spawn_pos   : IVector
    rotate      : IVector
}

export type TActionBlock = {
    pos             : Vector
    action_id       : int
    item            : IBlockItem
    destroy_block ? : { id: int }
}

type ActionBlocks = {
    list: TActionBlock[]
    options: {
        ignore_check_air    : boolean
        on_block_set        : boolean
        on_block_set_radius : number
    }
}

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

class IPaintingSize {
    name : string
    move: {x?: int, y?: int, z?: int}
    list: {y? : int, f? : int}[]
    size?: number[]
}

// Cached arrays of functions that are iterated. It's to avoid allocating new arrays.
const FUNCS: { [key: string]: Function[] } = {}

// Calc rotate
function calcRotate(rotate, n, rotate_by_pos_n_5) {
    rotate = new Vector(rotate);
    rotate.x = 0;
    rotate.y = 0;
    // top normal
    if (!rotate_by_pos_n_5 || (rotate_by_pos_n_5 && Math.abs(n.y) === 1)) {
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
    const painting_sizes = [
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
        } as IPaintingSize,
        // 4x3
        {
            name: '4x3',
            move: {y : 1},
            list: [
                {y: 1, f: -1}, {y: 1, f: 0}, {y: 1, f: 1}, {y: 1, f: 2},
                {y: 0, f: -1}, {y: 0, f: 0}, {y: 0, f: 1}, {y: 0, f: 2},
                {y: -1, f: -1}, {y: -1, f: 0}, {y: -1, f: 1}, {y: -1, f: 2}
            ]
        } as IPaintingSize,
        // 4x2
        {
            name: '4x2',
            move: {y : 1},
            list: [
                {y: 1, f: -1}, {y: 1, f: 0}, {y: 1, f: 1}, {y: 1, f: 2},
                {y: 0, f: -1}, {y: 0, f: 0}, {y: 0, f: 1}, {y: 0, f: 2}
            ]
        } as IPaintingSize,
        // 2x2
        {
            name: '2x2',
            move: {y : 2},
            list: [
                {y: 0, f: 0}, {y: 1, f: 0},
                {y: 0, f: 1}, {y: 1, f: 1}
            ]
        } as IPaintingSize,
        // 2x1
        {
            name: '2x1',
            move: {y : 1},
            list: [
                {y: 0, f: 0}, {y: 0, f: 1}
            ]
        } as IPaintingSize,
        // 1x2
        {
            name: '1x2',
            move: {y : 2},
            list: [
                {y: 0, f: 0}, {y: 1, f: 0}
            ]
        } as IPaintingSize,
        // 1x1
        {
            name: '1x1',
            move: {y : 1},
            list: [
                {y: 0, f: 0}
            ]
        } as IPaintingSize
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
    if(block.hasTag('drop_as_entity')) {
        item.extra_data = ObjectHelpers.deepClone(block.extra_data)
        item.entity_id = block.entity_id || randomUUID()
        item.count = 1
    }
    return item
}

/**
 * Drop block
 * @returns dropped blocks
 */
export function dropBlock(player : any = null, tblock : TBlock | FakeTBlock, actions : WorldAction, force : boolean, current_inventory_item? : any) : object[] {
    /*const isSurvival = true; // player.game_mode.isSurvival()
    if(!isSurvival) {
        return;
    }*/
    if(tblock.material.tags.includes('no_drop')) {
        return [];
    }

    const instrument_block = current_inventory_item ? BLOCK.fromId(current_inventory_item.id) : null

    const checkInstrument = (instrument_block : IBlockMaterial | null, drop : IBlockDropItem) => {
        if (!drop?.instrument) {
            return true
        }
        if (!instrument_block) {
            return false
        }
        const name = instrument_block.name
        return drop.instrument.includes(name) || drop.instrument.find(el => name.endsWith(el)) != null
    }

    const drop_item = tblock.material.drop_item

    // новый функционал
    if (Array.isArray(drop_item)) {
        for (const drop of drop_item) {
            if (drop && checkInstrument(instrument_block, drop)) {
                const block = BLOCK.fromName(drop.name)
                const chance = drop.chance ?? 1
                if(Math.random() < chance) {
                    let count = 1
                    if (drop?.count) {
                        if (typeof drop.count === 'object') {
                            count = ((Math.random() * (drop.count.max - drop.count.min)) | 0) + drop.count.min
                        } else {
                            count = drop.count
                        }
                    }
                    if(count > 0) {
                        const item = makeDropItem(tblock, {id: block.id, count: count})
                        actions.addDropItem({pos: tblock.posworld.clone().addScalarSelf(.5, 0, .5), items: [item], force: !!force})
                        return [item]
                    }
                }
            }
        }
    } else if(drop_item) {
        const drop_block = BLOCK.fromName(drop_item?.name);
        if(!drop_block.is_dummy) {
            const chance = drop_item.chance ?? 1;
            if(Math.random() < chance) {
                let count = drop_item.count;
                const min_max_count = drop_item.min_max_count;
                if(count || min_max_count) {
                    if(Array.isArray(count)) {
                        let count_index = (Math.random() * count.length) | 0;
                        count = count[count_index];
                    } else if (min_max_count) {
                        count = Mth.randomIntRange(min_max_count[0], min_max_count[1]);
                    }
                    count = Math.trunc(count);
                    if(count > 0) {
                        const item = makeDropItem(tblock, {id: drop_block.id, count: count});
                        actions.addDropItem({pos: tblock.posworld.clone().addScalarSelf(.5, 0, .5), items: [item], force: !!force});
                        return [item];
                    }
                }
            }
        } else {
            console.error('error_invalid_drop_item', drop_item);
        }
    } else {
        const items = [];
        // check if seeds
        if(tblock.material.seeds) {
            let result = null;
            if(tblock.extra_data.complete) {
                result = tblock.material.seeds.result?.complete;
            } else {
                result = tblock.material.seeds.result?.incomplete;
            }
            if(result) {
                for(let r of result) {
                    const count = Helpers.getRandomInt(r.count.min, r.count.max);
                    if(count > 0) {
                        const result_block = BLOCK.fromName(r.name.toUpperCase());
                        if(result_block.is_dummy) {
                            throw 'error_invalid_result_block|' + r.name;
                        }
                        items.push(makeDropItem(tblock, {id: result_block.id, count: count}));
                    }
                }
            }
        // default drop item
        } else if(tblock.material.spawnable) {
            items.push(makeDropItem(tblock, {id: tblock.id, count: 1}));
        }
        for(let item of items) {
            actions.addDropItem({pos: tblock.posworld.clone().addScalarSelf(.5, 0, .5), items: [item], force: !!force});
        }
        return items
    }
    return [];
}

// Destroy blocks
class DestroyBlocks {
    [key: string]: any;

    world: IWorld
    player: ActionPlayerInfo
    actions: WorldAction

    constructor(world: IWorld, player: ActionPlayerInfo, actions: WorldAction, current_inventory_item) {
        this.cv      = new VectorCollector();
        this.world   = world;
        this.player  = player;
        this.actions = actions;
        this.current_inventory_item = current_inventory_item;
    }

    //
    add(tblock : TBlock, pos, no_drop = false) {
        const cv        = this.cv;
        const world     = this.world;
        const player    = this.player;
        const actions   = this.actions;
        if(cv.has(tblock.posworld)) {
            return false;
        }
        cv.add(tblock.posworld, true);
        const destroyed_block = {pos: tblock.posworld, item: {id: BLOCK.AIR.id}, destroy_block: {id: tblock.id} as IBlockItem, action_id: ServerClient.BLOCK_ACTION_DESTROY}
        if(tblock.extra_data) {
            destroyed_block.destroy_block.extra_data = tblock.extra_data
        }
        actions.addBlocks([destroyed_block]);
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
                drop_items.push(...dropBlock(player, new FakeTBlock(disc_id, null, tblock.posworld.clone(), null, null, null, null, null, null), actions, false, this.current_inventory_item));
                // Stop play disc
                actions.stop_disc.push({pos: tblock.posworld.clone()});
            }
        }
        // Drop block if need
        if(!no_drop) {
            drop_items.push(...dropBlock(player, tblock, actions, false, this.current_inventory_item));
        }
        // удаляем капельники
        if (tblock.id == BLOCK.POINTED_DRIPSTONE.id && tblock?.extra_data) {
            const up = tblock.extra_data?.up;
            for (let sh = 1; sh < 8; sh++) {
                const position = tblock.posworld.offset(0, up ? -sh : sh, 0);
                const block = world.getBlock(position);
                if (block && block.id == BLOCK.POINTED_DRIPSTONE.id && block.extra_data?.up == up ) {
                    this.add(block, position);
                }
            }
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
        const head_connected_block = tblock.getHeadBlock(world)
        if(head_connected_block) {
            this.add(head_connected_block, head_connected_block.posworld.clone(), true)
        }
        // Destroy chain blocks to down
        if(tblock.material.tags.includes('destroy_to_down')) {
            let npos = tblock.posworld.add(Vector.YN);
            let nblock = world.getBlock(npos);
            if(nblock && tblock.material.name == nblock.material.name) {
                this.add(nblock, pos);
            }
        }
        //
        if(tblock.material.chest) {
            const di = drop_items[0]
            if(tblock.hasTag('store_items_in_chest')) {
                di.extra_data = {...tblock.extra_data}
                di.entity_id = tblock.entity_id || randomUUID()
            } else {
                if('extra_data' in di) delete(di.extra_data)
                if('entity_id' in di) delete(di.entity_id)
                actions.dropChest(tblock)
            }
        }
        //
        if(tblock.material.style_name == 'cover' && tblock.extra_data) {
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
    [key: string]: any;

    #world : any;
    /**
     * This id may not be unique.
     * It's assumed that for a non-malicious client, it's unique within one player session.
     *
     * Why isn't it globally unique?
     * A client needs to provide it, to identify its actions on the server. We can't trust the client.
     * So the server assumes it's not globally unique. So the client doesn't have to generate it globally unique.
     */
    id ? : string | int | null
    play_sound: PlaySoundParams[]
    drop_items: DropItemParams[]
    blocks: ActionBlocks
    mobs: {
        activate: ActivateMobParams[]
        spawn: any[] // it should be MobSpawnParams, but it's server class
    }
    sitting? : TSittingState
    sleep? : TSleepState
    /**
     * Если действие создается на основе {@link ICmdPickatData}, то это поле хранит {@link ICmdPickatData.controlEventId},
     * чтобы синхронизироваться с упарвлением по окончанию действия.
     */
    controlEventId? : int

    constructor(id ? : string | int | null, world? : any, ignore_check_air : boolean = false, on_block_set : boolean = true, notify : boolean = null) {
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
            put_in_bottle:              null,
            clone_block:                false,
            reset_mouse_actions:        false,
            decrement:                  false,
            decrement_extended:         null,
            decrement_instrument:       false,
            increment:                  null,
            /**
             * If it's true, then decrement is executed in creative mode in the same way as in normal mode.
             * It means "influence of the creative mode on the action" is ignored.
             * It doesn't mean "action in creative mode" is ignored.
             */
            ignore_creative_game_mode:  false,
            sitting:                    false,
            sleep:                      false,
            notify:                     notify,
            fluids:                     [],
            fluidFlush:                 false,
            blocks: {
                list: [],
                options: {
                    ignore_check_air: ignore_check_air,
                    on_block_set: on_block_set,
                    on_block_set_radius: 1
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

    /**
     * Creates a WorldAction with the same id and parameters, but without any actual actions.
     * The new action has no notify callback, to avoid calling it multiple times.
     */
    createSimilarEmpty() {
        const options = this.blocks.options;
        return new WorldAction(this.id, this.world, options.ignore_check_air, options.on_block_set, null);
    }

    // Add play sound
    addPlaySound(item: PlaySoundParams) {
        this.play_sound.push(item);
    }

    addBlock(item: TActionBlock): void {
        if(!item.action_id) {
            throw 'error_undefined_action_id';
        }
        /*if(!item.item.extra_data && item.item.id > 0) {
            const extra_data = BLOCK.makeExtraData(item.item, item.pos);
            if(extra_data) {
                throw 'error_empty_extra_data';
                // item.item.extra_data = extra_data;
            }
        }*/
        if(item.pos.x != Math.floor(item.pos.x)) throw 'error_invalid_block_pos'
        if(item.pos.y != Math.floor(item.pos.y)) throw 'error_invalid_block_pos'
        if(item.pos.z != Math.floor(item.pos.z)) throw 'error_invalid_block_pos'
        this.blocks.list.push(item)
    }

    // Add block
    addBlocks(items: TActionBlock[]): void {
        for(let i = 0; i < items.length; i++) {
            this.addBlock(items[i])
        }
    }

    addFluids(fluids : number[], offset? : Vector) {
        offset = offset || Vector.ZERO;
        for (let i = 0; i < fluids.length; i += 4) {
            this.fluids.push(fluids[i + 0] + offset.x, fluids[i + 1] + offset.y, fluids[i + 2] + offset.z, fluids[i + 3]);
        }
    }

    // Add drop item
    addDropItem(item: DropItemParams) {
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
    putInBottle(item) {
        if(this.put_in_bottle) {
            throw 'error_put_already';
        }
        this.put_in_bottle = item;
    }

    dropChest(tblock : TBlock) {
        if(!tblock.extra_data?.slots || tblock.hasTag('store_items_in_chest')) {
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
     */
    makeExplosion(vec_center : Vector, rad : float = 3, add_particles : boolean, drop_blocks_chance : any, power : float = .5) {

        const world = this.#world;
        const air = { id: 0 };
        const block_pos = new Vector();
        const extruded_blocks = new VectorCollector();

        drop_blocks_chance = parseFloat(drop_blocks_chance);

        //
        const createAutoDrop = (tblock : TBlock) => {
            const mat = tblock.material;
            if(!mat.can_auto_drop) {
                return false;
            }
            if((!mat.chest && !Number.isNaN(drop_blocks_chance) && Math.random() > drop_blocks_chance) || tblock.id == BLOCK.TNT.id) {
                return false;
            }
            const pos = tblock.posworld.clone().addScalarSelf(.5, .5, .5)
            extruded_blocks.set(pos, 'drop');
            if(mat.chest) {
                if(tblock.hasTag('store_items_in_chest')) {
                    const drop_item = {
                        id: mat.id,
                        count: 1
                    } as IBlockItem
                    drop_item.extra_data = {...tblock.extra_data}
                    drop_item.entity_id = tblock.entity_id || randomUUID()
                } else {
                    this.dropChest(tblock)
                }
            }
            dropBlock(null, tblock, this, true)
            return true
        };

        const distance              = rad;
        const maxDistance           = Math.ceil(distance * 1.1);
        const listBlockDestruction  = new VectorCollector();
        const vec                   = new Vector(0, 0, 0);
        const strength              = power; // (power + 1.) * .97;
        const bePresentBlock        = new VectorCollector(); // Массив присутствующих блоков в кэше, для оптимизации повторного изъятия данных блока

        let repeat = false;
        let rays = 0;

        // const p = performance.now();

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
                        {
                            pos: pos.clone(),
                            item: air,
                            action_id: ServerClient.BLOCK_ACTION_REPLACE
                        }
                    ]);
                } else if (block.tblock.id == BLOCK.TNT.id) {
                    if (!block.tblock.extra_data.explode) {
                        this.addBlocks([
                            {
                                pos: pos.clone(),
                                item: {
                                    id: BLOCK.TNT.id,
                                    extra_data: {
                                        explode: true,
                                        fuse: 8
                                    }
                                },
                                action_id: ServerClient.BLOCK_ACTION_MODIFY
                            }
                        ]);
                    }
                } else {
                    this.addBlocks([
                        {
                            pos: pos.clone(),
                            item: air,
                            action_id: ServerClient.BLOCK_ACTION_REPLACE
                        }
                    ]);
                    extruded_blocks.set(pos, 'extruded');
                    // не вся часть блоков при взрыве динамита дропается
                    if (Math.random() <= 0.7) {
                        createAutoDrop(block.tblock);
                    }
                }
            }
        }

        //
        for(let vec of extruded_blocks.keys()) {
            // 1. check under
            const check_under_poses = [
                vec.clone().addSelf(Vector.YP),
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
     */
    setSitting(pos : Vector, rotate : Vector) {
        this.sitting = {pos, rotate};
        this.addPlaySound({tag: 'madcraft:block.cloth', action: 'hit', pos: new Vector(pos), except_players: []});
    }

    /**
     * Set sleep
     */
    setSleep(pos : Vector, rotate : Vector) {
        this.sleep = {pos, rotate}
        this.addPlaySound({tag: 'madcraft:block.cloth', action: 'hit', pos: new Vector(pos), except_players: []});
    }

    // Spawn mob (первая генерация моба, если его ещё не было в БД)
    spawnMob(params : any) {
        this.mobs.spawn.push(params);
    }

    // Activate mob (активация ранее созданного моба)
    activateMob(params: ActivateMobParams): void {
        this.mobs.activate.push(params);
    }

    generateTree(params) {
        this.generate_tree.push(params);
    }

    appendMechanismBlocks(qi : IQuboidInfo) {
        this.mechanism = {
            action: 'append_blocks',
            append_blocks: qi,
        }
    }

}

function simplifyPos(world : any, pos : IVectorPoint, mat : IBlockMaterial, to_top : boolean, check_opposite : boolean = true) {
    if(pos.n.y === 0 && !mat.layering && !mat.tags.includes('rotate_by_pos_n') && !mat.tags.includes('rotate_by_pos_n_5') && !mat.tags.includes('rotate_by_pos_n_6') && !mat.tags.includes('rotate_by_pos_n_xyz') && !mat.tags.includes('trapdoor') && !mat.tags.includes('stairs')) {
        const side_y = to_top ? -1 : 1
        const tblock = world.getBlock(new Vector(pos).addScalarSelf(pos.n.x, side_y, pos.n.z))
        if(tblock.canPlaceOnTopOrBottom(to_top)) {
            pos.x += pos.n.x
            pos.y += side_y
            pos.z += pos.n.z
            pos.n.x = 0
            pos.n.y = -side_y
            pos.n.z = 0
        } else if(check_opposite) {
            return simplifyPos(world, pos, mat, !to_top, false)
        }
    }
    return false
}

/**
 * It creates an action based on the player's PickAt result.
 * @returns a tuple:
 * - the actions that needs to be performed
 * - the position of an existing block that should have been affected by these actions, if they were successful.
 * This position may be used to create a history snapsoht, or get the correct block state for a failed action.
 */
export async function doBlockAction(e, world, action_player_info: ActionPlayerInfo, current_inventory_item): Promise<[WorldAction | null, Vector | null]> {

    const actions = new WorldAction(e.id);
    const destroyBlocks = new DestroyBlocks(world, action_player_info, actions, current_inventory_item);
    const blockFlags = BLOCK.flags

    if(!e.pos) {
        console.error('empty e.pos');
        return [null, null];
    }

    // set radius for onBlockSet method
    actions.blocks.options.on_block_set_radius = 2;

    let pos                 = e.pos;
    let world_block         = world.getBlock(pos);
    if (!world_block || world_block.id < 0) { // if it's a DUMMY, the chunk is not loaded
        return [null, null];
    }
    let world_material      = world_block && (world_block.id > 0 || world_block.fluid > 0) ? world_block.material : null;
    let extra_data          = world_block ? world_block.extra_data : null;
    let world_block_rotate  = world_block ? world_block.rotate : null;

    // protect from indirect changes
    if(extra_data) extra_data = ObjectHelpers.deepClone(extra_data);

    // Check world block material
    if(!world_material && (e.cloneBlock || e.createBlock)) {
        console.error('error_empty_world_material', world_block.id, pos);
        return [null, null];
    }

    // 1. Change extra data
    if(e.changeExtraData) {
        for(let func of FUNCS.changeExtraData ??= [editSign, editBeacon]) {
            if(func(e, world, pos, action_player_info, world_block, world_material, null, current_inventory_item, extra_data, world_block_rotate, null, actions)) {
                return [actions, pos];
            }
        }
    }

    // 2. Destroy
    if(e.destroyBlock) {
        // 1. Проверка выполняемых действий с блоками в мире
        for(let func of FUNCS.destroyBlock ??= [removeFromPot, deletePortal, removeFurnitureUpholstery]) {
            if(func(e, world, pos, action_player_info, world_block, world_material, null, current_inventory_item, extra_data, world_block_rotate, null, actions)) {
                return [actions, pos];
            }
        }
        // 2.
        if(!world_material || !NO_DESTRUCTABLE_BLOCKS.includes(world_material.name)) {
            const tblock = world.getBlock(pos);
            if(tblock?.id > 0) {
                destroyBlocks.add(tblock, pos);
                actions.decrement_instrument = {id: tblock.id};
                /*if(!tblock.material.destroy_to_down) {
                    // Destroyed block
                    pos = new Vector(pos);
                    // destroy plants over this block
                    let block_over = world.getBlock(pos.add(Vector.YP));
                    if(BLOCK.isPlants(block_over.id)) {
                        destroyBlocks.add(block_over, pos);
                    }
                }
                */
            }
        }
        return [actions, pos];
    }

    // 3. Clone
    if(e.cloneBlock) {
        if(world_material && e.number == 1) {
            actions.clone_block = e.pos;
        }
        return [actions, pos];
    }

    // 4. Create
    if(e.createBlock) {

        // Получаем материал выбранного блока в инвентаре
        let mat_block = current_inventory_item ? BLOCK.fromId(current_inventory_item.id) : null;

        if(mat_block && !mat_block.is_dummy && mat_block.item?.emit_on_set) {
            // bucket etc.
            mat_block = BLOCK.fromName(mat_block.item.emit_on_set);
        }

        if(mat_block && !mat_block.is_dummy && (mat_block.deprecated || (!world.isBuildingWorld() && (blockFlags[mat_block.id] & BLOCK_FLAG.NOT_CREATABLE)))) {
            console.warn('warning_mat_block.deprecated');
            return [null, pos];
        }

        // Проверка выполняемых действий с блоками в мире
        for(let func of FUNCS.createBlock ??= [sitDown, getEggs, putIntoPot, needOpenWindow, ejectJukeboxDisc, pressToButton, goToBed, openDoor, eatCake, addFewCount, openFenceGate, useTorch, setOnWater, putKelp, putInComposter]) {
            if(func(e, world, pos, action_player_info, world_block, world_material, mat_block, current_inventory_item, extra_data, world_block_rotate, null, actions)) {
                return [actions, pos];
            }
        }

        // Дальше идут действия, которые обязательно требуют, чтобы в инвентаре что-то было выбрано
        if(!current_inventory_item || current_inventory_item.count < 1) {
            console.warn('warning_no_current_inventory_item');
            return [null, pos];
        }

        // Проверка выполняемых действий с блоками в мире
        for(let func of FUNCS.useItem1 ??= [useCauldron, useShears, chSpawnMob, putInBucket, noSetOnTop, putPlate, setFurnitureUpholstery, setPointedDripstone]) {
            if(func(e, world, pos, action_player_info, world_block, world_material, mat_block, current_inventory_item, extra_data, world_block_rotate, null, actions)) {
                const affectedPos = (func === chSpawnMob) ? null : pos // мобы не меняют блок. И chSpawnMob также портит pos
                return [actions, affectedPos]
            }
        }
        for(let func of FUNCS.useItem1async ??= [openPortal, putDiscIntoJukebox]) {
            if(await func(e, world, pos, action_player_info, world_block, world_material, mat_block, current_inventory_item, extra_data, world_block_rotate, null, actions)) {
                return [actions, pos];
            }
        }

        // Другие действия с инструментами/предметами в руке
        if(mat_block.item && mat_block.style_name != 'planting') {
            // Use intruments
            for(let func of FUNCS.useItem2 ??= [useShovel, useHoe, useAxe, useBoneMeal, MechanismAssembler.useMechanismAssemblerWorldAction]) {
                if(func(e, world, pos, action_player_info, world_block, world_material, mat_block, current_inventory_item, extra_data, world_block_rotate, null, actions)) {
                    return [actions, pos];
                }
            }
            for(let func of FUNCS.useItem2async ??= [useFlintAndSteel]) {
                if(await func(e, world, pos, action_player_info, world_block, world_material, mat_block, current_inventory_item, extra_data, world_block_rotate, null, actions)) {
                    return [actions, pos];
                }
            }
        } else if (mat_block.is_fluid) {
            if (world_material.is_solid) {
                pos.x += pos.n.x;
                pos.y += pos.n.y;
                pos.z += pos.n.z;
                world_block = world.getBlock(pos);
                if (!(world_block.id >= 0)) { // if it's outside the loaded chunk
                    return [null, null];
                }
            }
            const origFluidType = (world_block.fluid & FLUID_TYPE_MASK);
            const myFluidType = (isFluidId(mat_block.id) & FLUID_TYPE_MASK);
            if (origFluidType > 0 && origFluidType !== myFluidType) {
                return [actions, pos];
            }
            actions.addFluids([0, 0, 0, myFluidType], pos);
            actions.decrement = true;
            actions.ignore_creative_game_mode = !!current_inventory_item.entity_id;
            if(mat_block.sound) {
                actions.addPlaySound({tag: mat_block.sound, action: 'place', pos: new Vector(pos), except_players: [action_player_info.session.user_id]});
            }
        } else {

            const replaceBlock = world_material && BLOCK.canReplace(world_material.id, world_block.extra_data, current_inventory_item.id);

            // Change n side and pos
            if(!replaceBlock) {
                simplifyPos(world, pos, mat_block, pos.point.y < .5, true)
            }

            // Calc orientation
            let orientation = calcBlockOrientation(mat_block, action_player_info.rotate, pos.n)

            // Check if replace
            if(replaceBlock) {
                if(world_material.previous_part || world_material.next_part || current_inventory_item.style_name == 'ladder') {
                    return [actions, pos];
                }
                pos.n.x = 0;
                pos.n.y = 1;
                pos.n.z = 0;
                orientation = calcBlockOrientation(mat_block, action_player_info.rotate, pos.n);
            } else {
                if(increaseLayering(e, world, pos, action_player_info, world_block, world_material, mat_block, current_inventory_item, extra_data, world_block_rotate, null, actions)) {
                    return [actions, pos];
                }
                pos.x += pos.n.x;
                pos.y += pos.n.y;
                pos.z += pos.n.z;
                const block_on_posn = world.getBlock(pos);
                if (!(block_on_posn.id >= 0)) { // if it's outside the loaded chunk
                    return [null, null];
                }
                // Запрет установки блока, если на позиции уже есть другой блок
                if(!block_on_posn.canReplace()) {
                    console.error('!canReplace', block_on_posn.material.name);
                    return [null, pos];
                }
            }

            // Запрет установки блока на блоки, которые занимает игрок
            if (mat_block.passable == 0 &&
                !(orientation.y == 0 && mat_block.tags.includes("rotate_by_pos_n_5"))
            ) {
                _createBlockAABB.set(pos.x, pos.y, pos.z, pos.x + 1, pos.y + 1, pos.z + 1);
                if(_createBlockAABB.intersect({
                    // player.radius = player's diameter
                    x_min: action_player_info.pos.x - action_player_info.radius / 2,
                    x_max: action_player_info.pos.x - action_player_info.radius / 2 + action_player_info.radius,
                    y_min: action_player_info.pos.y,
                    y_max: action_player_info.pos.y + action_player_info.height,
                    z_min: action_player_info.pos.z - action_player_info.radius / 2,
                    z_max: action_player_info.pos.z - action_player_info.radius / 2 + action_player_info.radius
                })) {
                    console.error('intersect with player');
                    return [null, pos];
                }
            }

            // Некоторые блоки можно ставить только на что-то сверху
            if(mat_block.is_layering && !mat_block.layering.slab && pos.n.y != 1) {
                console.error('mat_block.is_layering');
                return [null, pos];
            }

            // Некоторые блоки можно только подвешивать на потолок
            if(mat_block.tags.includes('place_only_to_ceil') && pos.n.y != -1) {
                console.error('place_only_to_ceil');
                return [null, pos];
            }

            // некоторые блоки нельзя ставить на стены (например LANTERN)
            if(pos.n.y === 0 && mat_block.tags.includes('cant_place_on_wall')) {
                console.error('cant_place_on_wall');
                return [null, pos];
            }

            // Create block
            const new_item : IBlockItem = {
                id: mat_block.id,
                rotate: orientation
            };
            for(const prop of ['entity_id', 'extra_data', 'power']) {
                if(prop in current_inventory_item) {
                    new_item[prop] = current_inventory_item[prop];
                }
            }

            // Special behavior for some fields, see EXTRA_DATA_SPECIAL_FIELDS_ON_PLACEMENT
            if (new_item.extra_data) {
                let hasSpecialFields = false;
                let hasOtherFields = false;
                for(let key in new_item.extra_data) {
                    if (EXTRA_DATA_SPECIAL_FIELDS_ON_PLACEMENT.includes(key)) {
                        hasSpecialFields = true;
                    } else {
                        hasOtherFields = true;
                    }
                }
                if (mat_block.is_entity) {
                    if (!hasOtherFields) {
                        // merge extra_data
                        new_item.extra_data = Object.assign(
                            BLOCK.makeExtraData(mat_block, pos, new_item.rotate, world),
                            new_item.extra_data
                        );
                    }
                } else {
                    if (!hasOtherFields) {
                        // allow it be overwritten by BLOCK.makeExtraData
                        new_item.extra_data = null;
                    } else if (hasSpecialFields) {
                        // clone it without special fields
                        const new_extra_data = {};
                        for(let key in new_item.extra_data) {
                            if (!EXTRA_DATA_SPECIAL_FIELDS_ON_PLACEMENT.includes(key)) {
                                new_extra_data[key] = new_item.extra_data[key];
                            }
                        }
                        new_item.extra_data = new_extra_data;
                    }
                }
            }

            new_item.extra_data = new_item.extra_data || BLOCK.makeExtraData(mat_block, pos, new_item.rotate, world);
            // If painting
            if(mat_block.id == BLOCK.PAINTING.id) {
                new_item.extra_data = await createPainting(e, world, pos);
                if(!new_item.extra_data) {
                    console.error('error_painting_data_is_empty');
                    return [null, pos];
                }
            }
            // Material restrictions
            for(let func of FUNCS.restrict ??= [restrictPlanting, restrictOnlyFullFace, restrictLadder, restrictTorch]) {
                if(func(e, world, pos, action_player_info, world_block, world_material, mat_block, current_inventory_item, extra_data, world_block_rotate, replaceBlock, actions, orientation)) {
                    return [actions, pos];
                }
            }
            // 
            
            // Rotate block one of 8 poses
            if(mat_block.tags.includes('rotate_x8')) {
                if(new_item.rotate.y != 0) {
                    new_item.rotate.x = Math.round(action_player_info.rotate.z / 45) * 45;
                }
            }
            // Rotate block one of 16 poses
            if(mat_block.tags.includes('rotate_x16')) {
                if(new_item.rotate.y != 0) {
                    new_item.rotate.x = action_player_info.rotate.z / 90;
                }
            }
            // Rotate block as sign
            if(mat_block.tags.includes('rotate_sign')) {
                if(new_item.rotate.y == 0 && pos.point.y >= .5) {
                    new_item.rotate.y = -1
                }
                if(new_item.rotate.y != 0) {
                    new_item.rotate.x = action_player_info.rotate.z / 90;
                }
            }
            // Auto open edit window if sign
            if(mat_block.style_name == 'sign') {
                actions.open_window = {
                    id: 'frmEditSign',
                    args: {pos: new Vector(pos)}
                };
            }
            // Pre place
            for(let func of FUNCS.prePlace ??= [prePlaceRail]) {
                if(func(world, pos, new_item, actions)) {
                    return [actions, pos];
                }
            }
            //
            if(setActionBlock(actions, world, new Vector(pos), new_item.rotate, mat_block, new_item)) {
                if(mat_block.sound) {
                    actions.addPlaySound({tag: mat_block.sound, action: 'place', pos: new Vector(pos), except_players: [action_player_info.session.user_id]});
                }
                actions.decrement = true;
                actions.ignore_creative_game_mode = !!current_inventory_item.entity_id;
            }
        }

        return [actions, pos];
    }

}

//
function calcBlockOrientation(mat_block, rotate, n) {
    let resp = null;
    const rotate_by_pos_n_5 = mat_block.tags.includes('rotate_by_pos_n_5');
    if(mat_block.tags.includes('rotate_by_pos_n')) {
        resp = calcRotateByPosN(rotate, n);
        if(mat_block.tags.includes('rotate_by_pos_n_xyz')) {
            if(resp.y) resp.set(0, 1, 0);
            if(resp.x == CD_ROT.SOUTH) resp.set(7, 0, 0);
            if(resp.x == CD_ROT.EAST) resp.set(13, 0, 0);
        }
    } else {
        resp = calcRotate(rotate, n, rotate_by_pos_n_5);
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
        // const new_rotate = orientation.clone().addScalarSelf(2, 0, 0);
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
            console.error(pb_block.material.name, mat_block.name)
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
                    head_pos.multiplyScalarSelf(-1);
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
function needOpenWindow(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if(!world_material.has_window || e.shiftKey) {
        return false;
    }
    // if is chest
    if(world_material.chest) {
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
function getEggs(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if(!world_block || world_block.id != BLOCK.CHICKEN_NEST.id || extra_data.eggs == 0) {
        return false;
    }
    actions.increment = {id: BLOCK.EGG.id, count: extra_data.eggs};
    actions.addBlocks([{pos: new Vector(pos), item: {id: BLOCK.CHICKEN_NEST.id, extra_data: {eggs: 0}}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
    return true;
}

// Put into pot
function putIntoPot(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
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
                            item_frame || (
                                mat_block &&
                                (
                                    mat_block.planting ||
                                    mat_block.style_name == 'cactus' ||
                                    mat_block.tags.includes('can_put_into_pot')
                                )
                            )
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
    actions.addBlocks([{pos: new Vector(pos), item: {id: world_block.id, rotate, extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
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
                        item: {id: world_material.id, rotate, extra_data},
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
function chSpawnMob(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if(!BLOCK.isSpawnEgg(mat_block.id)) {
        return false;
    }
    if(world_material.id == BLOCK.MOB_SPAWN.id) {
        extra_data.type = mat_block.spawn_egg.type;
        extra_data.skin = mat_block.spawn_egg.skin;
        extra_data.max_ticks = 800;
        actions.addBlocks([{pos: new Vector(pos), item: {id: BLOCK.MOB_SPAWN.id, rotate, extra_data}, action_id: ServerClient.BLOCK_ACTION_REPLACE}]);
        actions.decrement = true;
        return true;
    }
    if (pos.n) {
        pos.x += pos.n.x + .5
        pos.y += pos.n.y;
        pos.z += pos.n.z + .5;
    } else {
        // Если спауним на воде - pos.n нет, но надо немного поднять позицию.
        // Насколько лучше поднять - зависит от mobConfig.config.physics.floatSubmergedHeight,
        // но этот метод в клиентском коде, хотя и серверный :(
        pos.x += 0.5
        pos.y += 0.7
        pos.z += 0.5
    }
    actions.chat_message = {text: `/spawnmob ${pos.x} ${pos.y} ${pos.z} ${mat_block.spawn_egg.type} ${mat_block.spawn_egg.skin}`};
    actions.decrement = true;
    return true;
}

// Put in bucket
function putInBucket(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if(!mat_block || mat_block.id != BLOCK.BUCKET.id) {
        return false;
    }
    let added_to_bucket = false;
    if(world_material.put_in_bucket) {
        // get filled bucket
        const filled_bucket = BLOCK.fromName(world_material.put_in_bucket);
        if(!filled_bucket.is_dummy) {
            const item : IBlockItem = {
                id: filled_bucket.id,
                count: 1
            };
            if(world_material.extra_data) {
                item.extra_data = world_material.extra_data;
            }
            // put in bucket
            actions.putInBucket(item);
            // destroy world block
            actions.addBlocks([{pos: new Vector(pos), item: {id: BLOCK.AIR.id}, destroy_block: {id: world_material.id}, action_id: ServerClient.BLOCK_ACTION_DESTROY}]);
            added_to_bucket = true;
        }
    } else if (pos.fluidLeftTop) {
        const fluidType = pos.fluidVal & FLUID_TYPE_MASK;
        if(fluidType > 0) {
            if(fluidType === FLUID_WATER_ID) {
                actions.addFluids([0, 0, 0, 0], pos.fluidLeftTop);
                const filled_bucket = BLOCK.fromName('WATER_BUCKET');
                const item = {
                    id: filled_bucket.id,
                    count: 1
                };
                actions.putInBucket(item);
                added_to_bucket = true;
            }
            if(fluidType === FLUID_LAVA_ID) {
                actions.addFluids([0, 0, 0, 0], pos.fluidLeftTop);
                const filled_bucket = BLOCK.fromName('LAVA_BUCKET');
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
function ejectJukeboxDisc(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
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
    actions.addBlocks([{pos: pos.clone(), item: {id: world_material.id, rotate, extra_data: null}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
    actions.stop_disc.push({pos: pos.clone()});
    return true;
}

// Press to button
function pressToButton(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    // Buttons
    if(e.shiftKey || !world_material.is_button) {
        return false;
    }
    extra_data = extra_data || {}
    extra_data.pressed = !extra_data.pressed ? 1 : 0;
    if(extra_data && 'pressed' in extra_data) {
        pos = new Vector(pos);
        actions.addBlocks([{pos: pos, item: {id: world_material.id, rotate, extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
        actions.addPlaySound({tag: 'madcraft:block.player', action: 'click', pos: new Vector(pos), except_players: [player.session.user_id]});
        actions.reset_mouse_actions = true;
        return true;
    }
    return false;
}

/**
 * Sit down
 */
function sitDown(e, world, pos : Vector, player : ActionPlayerInfo, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate : Vector, replace_block, actions : WorldAction): boolean {
    if(e.shiftKey) {
        return false
    }
    const is_chair = world_material.style_name == 'chair'
    const is_stool = world_material.style_name == 'stool'
    const is_slab   = world_material.layering && world_material.height == .5
    const is_stairs = world_material.tags.includes('stairs')
    if (!is_chair && !is_stool && !is_slab && !is_stairs) {
        return false
    }
    // проверям это верхняя или нижняя половинка полублока
    if ((is_slab || is_stairs) && ((world_block.extra_data?.point?.y > .5) || current_inventory_item != null)) {
        return false
    }
    // выходим из обработки, если клеим шерсть
    if ((is_stool || is_chair) && mat_block?.tags.includes('wool')) {
        return false
    }
    // проверяем что сверху нет блока
    if (is_slab || is_stairs || is_stool) {
        const block = world.getBlock(world_block.posworld.offset(0, 1, 0))
        if (block.id != 0 || block.fluid != 0) {
            if (!Qubatch.is_server) {
                Qubatch.hotbar.strings.setText(1, Lang.pos_not_valid, 4000)
            }
            return true
        }
    }
    const is_head = world_material?.has_head && world_block.extra_data.is_head
    if(!getValidPosition(world_block.posworld.offset(0, is_head ? -1 : 0, 0), world)) {
        if (!Qubatch.is_server) {
            Qubatch.hotbar.strings.setText(1, Lang.pos_not_valid, 4000)
        }
        return true
    }
    const sit_height = (is_chair || is_stool) ? 11/16 : 1/2
    const sit_pos = new Vector(
        pos.x + .5,
        pos.y + sit_height - (is_head ? 1 : 0),
        pos.z + .5
    )
    for(const player of world.players.eachContainingVec(sit_pos)) {
        if (player.sharedProps.sitting) {
            if (!Qubatch.is_server) {
                Qubatch.hotbar.strings.setText(1, Lang.pos_occupied, 4000)
            }
            return true
        }
    }
    // sit down
    actions.reset_mouse_actions = true
    const yaw = rotate
        ? Helpers.deg2rad(rotate.x)
        : player.rotate.z
    actions.setSitting(sit_pos, new Vector(0, 0, yaw))
    return true
}

// Нельзя ничего ставить поверх этого блока
function noSetOnTop(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    const noSetOnTop = world_material.tags.includes('no_set_on_top');
    return noSetOnTop && pos.n.y == 1;
}

// Edit beacon
function editBeacon(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
    if (world_material.id != BLOCK.BEACON.id) {
        return false
    }
    const item = e.extra_data.slots[0]
    if (item && item.count == 1 && [BLOCK.GOLD_INGOT.id, BLOCK.IRON_INGOT.id, BLOCK.NETHERITE_INGOT.id, BLOCK.DIAMOND.id, BLOCK.EMERALD.id].includes(item.id)) {
        e.extra_data.slots = {}
        actions.addBlocks([{pos: new Vector(pos), item: {id: world_material.id, rotate, extra_data: e.extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}])
        return true
    }
    return true // @todo false error server
}

// Edit sign
function editSign(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {
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
                actions.addBlocks([{pos: new Vector(pos), item: {id: world_material.id, rotate, extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
            }
        }
    }
    return true;
}

// Go to bed
function goToBed(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    const goToBed = !e.shiftKey && world_material && (world_material.tags.includes('bed'))
    if(!goToBed) {
        return false
    }
    // растояние до кровати (java не более 2, br не более 3)
    if(player.pos.distance(pos) > 3.0) {
        if (!Qubatch.is_server) {
            Qubatch.hotbar.strings.setText(1, Lang.bed_to_far_away, 4000)
        }
        return true
    }
    const bedHeight = world_material.bb?.behavior?.height ?? world_material.height ?? 1
    const headY = bedHeight + 0.063 // эта константа подобнана чтобы игрок не проваливался сквозь кровать
    // где находится подушка у кровати (голова игрока, когда лежит)
    let position_head : Vector = world_block.posworld.offset(.5, headY, !extra_data?.is_head ? -.42 : .58)
    if (rotate.x == DIRECTION.SOUTH) {
        position_head = world_block.posworld.offset(.5, headY, !extra_data?.is_head ? 1.42 : .42)
    } else if (rotate.x == DIRECTION.WEST) {
        position_head = world_block.posworld.offset(!extra_data?.is_head ? 1.42 : .42, headY, .5)
    } else if (rotate.x == DIRECTION.EAST) {
        position_head = world_block.posworld.offset(!extra_data?.is_head ? -.42 : 0.58, headY, .5)
    }
    // Проверяем, что кровать не заблочена
    const block = world.getBlock(position_head.offset(0, 1, 0).flooredSelf())
    /*if (block.id != 0 || block.fluid != 0) {
        if (!Qubatch.is_server) {
            Qubatch.hotbar.strings.setText(1, Lang.bed_not_valid, 4000)
        }
        //return true
    }*/
    for(const player of world.players.eachContainingVec(position_head)) {
        if (player.sharedProps.sleep) {
            if (!Qubatch.is_server) {
                Qubatch.hotbar.strings.setText(1, Lang.bed_occupied, 4000)
            }
            return true
        }
    }
    actions.reset_mouse_actions = true
    // разворот игрока, что бы ноги всегда лежали на кровате
    const player_rotation = new Vector(0, 0, ((rotate.x + 2) % 4) / 4)
    actions.setSleep(position_head, player_rotation)
    if (Qubatch.is_server) {
        world.getSleep(player.session.user_id, position_head)
    }
    return true
}

// Eat cake
function eatCake(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
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
            actions.addBlocks([{pos: new Vector(pos), item: {id: BLOCK.AIR.id}, destroy_block: {id: world_material.id}, action_id: ServerClient.BLOCK_ACTION_DESTROY}]);
            actions.addPlaySound({tag: 'madcraft:block.player', action: 'burp', pos: new Vector(pos), except_players: [player.session.user_id]});
        } else {
            actions.addBlocks([{pos: new Vector(pos), item: {id: world_material.id, rotate, extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
            actions.reset_mouse_actions = true;
            actions.addPlaySound({tag: 'madcraft:block.player', action: 'eat', pos: new Vector(pos), except_players: [player.session.user_id]});
        }
        const server_player = world.players.get(player.session.user_id);
        if (server_player.damage) {
            server_player.setFoodLevel(world_material.food.amount, world_material.food.saturation)
        }
    }
    return true;
}

/**
 * удаление портала
 *
 * TODO it never returns true, probably unfinished
 */
function deletePortal(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {

    // get frame material
    let portal_frame_block_name = null;
    if(world_material) {
        const type = WorldPortal.getPortalTypeForFrame(world_material);
        if(type) {
            portal_frame_block_name = type.block_name;
        }
    }

    if (!world_material || (world_material.id != BLOCK.NETHER_PORTAL.id && world_material.name != portal_frame_block_name)) {
        return false;
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
                action_id: ServerClient.BLOCK_ACTION_REPLACE
            });
        }
        actions.addBlocks(arr);
        //
        if(portal_ids.size > 0 && Qubatch.is_server) {
            for(let portal_id of portal_ids.keys()) {
                console.log('delete portal ', portal_id);
                world.db.portal.delete(player, portal_id);
            }
        }
    }

}


async function openPortal(e, world, pos, player, world_block, world_material : IBlockMaterial, mat_block? : IBlockMaterial, current_inventory_item? : IBlockMaterial, extra_data? : any, rotate? : Vector, replace_block? : any, actions ?: any) : Promise<boolean> {
    const bm = world.block_manager

    if (!world_material || !current_inventory_item) {
        return false
    }

    const position = new Vector(pos)
    position.addSelf(pos.n)

    // Если материал используется для портала и игрок в биоме
    const portal_type = WorldPortal.getPortalTypeForFrame(world_material)
    if(!portal_type || !world.info.generator.rules.portals) {
        return false
    }

    const activator_ok = !portal_type.activator_block_material || (mat_block.name == portal_type.activator_block_material)
    if(!activator_ok) {
        return false
    }

    if(mat_block.name == 'FLINT_AND_STEEL') {
        actions.addPlaySound({tag: 'madcraft:fire', action: 'flint_and_steel_click', pos: position, except_players: [player.session.user_id]})
    }

    const frame_block_id = world_material.id

    // находим растояние до стенки
    const getDistanceEdge = (pos, dir) => {
        for (let i = 0; i < MAX_SIZE_PORTAL; i++) {
            let blockpos = new Vector(pos.x + i, pos.y, pos.z);
            switch (dir) {
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
            if (world.getBlock(blockpos).id !=  bm.AIR.id || world.getBlock(blockpos.add(Vector.YN)).id != frame_block_id) {
                return world.getBlock(blockpos).id == frame_block_id ? i : 0;
            }
        }
        return 0
    }

    // проверям целостность рамки
    const checkFrame = (pos: Vector, dir: DIRECTION) => {
        const right = getDistanceEdge(pos, dir == DIRECTION.NORTH ? DIRECTION.NORTH : DIRECTION.WEST)
        const left = getDistanceEdge(pos, dir == DIRECTION.NORTH ? DIRECTION.SOUTH : DIRECTION.EAST)
        let height = 0
        for (height = 0; height < MAX_SIZE_PORTAL; height++) {
            const block = world.getBlock(pos.offset(0, height, 0))
            if (block.id != 0) {
                break
            }
        }
        if (height < 3 || right == 0 || left == 0 || (right + left) < 3) {
            return null
        }
        for (let j = 1; j < (left + right); j++) {
            const block_top = world.getBlock(pos.offset(dir == DIRECTION.NORTH ? 0 : left-j, height, dir == DIRECTION.NORTH ? j-left : 0))
            if (block_top.id != frame_block_id) {
                return null
            }
        }
        for (let i = 0; i < height; i++) {
            const block_left = world.getBlock(pos.offset(dir == DIRECTION.NORTH ?  0 : left, i, dir == DIRECTION.NORTH ? -left : 0))
            const block_right = world.getBlock(pos.offset( dir == DIRECTION.NORTH ? 0 : -right, i,  dir == DIRECTION.NORTH ? right : 0))
            if (block_left.id != block_right.id) {
                return null
            }
            for (let j = 1; j < (left + right); j++) {
                const block_top = world.getBlock(pos.offset(dir == DIRECTION.NORTH ? 0 : left-j, i, dir == DIRECTION.NORTH ? j-left : 0))
                if (block_top.id != 0) {
                    return null
                }
            }
        }
        return {height: height, left: left - 1, width: (left + right) - 1}
    }

    async function createPortal(pos: Vector, dir: DIRECTION) {

        const frame = checkFrame(pos, dir)
        if (!frame) {
            return false
        }
        // Блок портала
        const portal_block : IBlockItem = {
            id: BLOCK.NETHER_PORTAL.id,
            rotate: new Vector(
                dir != DIRECTION.NORTH ? DIRECTION.SOUTH : DIRECTION.EAST,
                1,
                0
            )
        }
        const bottom_left = (dir != DIRECTION.NORTH) ? nullpos.offset(frame.left, 0, 0) : nullpos.offset(0, 0, -frame.left);

        // Сохраняем портал в БД
        const portal = {
            pos:                bottom_left.clone(),
            rotate:             new Vector(portal_block.rotate),
            size:               {width: frame.width + 2, height: frame.height + 2},
            player_pos:         bottom_left.clone(),
            pair_pos:           null,
            portal_block_id:    portal_block.id,
            type:               portal_type.id
        };
        //
        if(dir == DIRECTION.NORTH) {
            portal.player_pos.addScalarSelf(frame.width / 2, 1, .5);
        } else {
            portal.player_pos.addScalarSelf(.5, 1, frame.width / 2);
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
        const arr = []
        for(let i = 0; i < frame.height; i++) {
            for(let j = 0; j < frame.width; j++) {
                arr.push(
                {
                    pos: (dir == DIRECTION.NORTH) ? bottom_left.offset(0, i, j) : bottom_left.offset(-j, i, 0),
                    item: portal_block,
                    action_id: ServerClient.BLOCK_ACTION_CREATE
                })
            }
        }
        actions.addBlocks(arr)
        return true
    }

    // спускаемся к основанию
    const nullpos = position.clone()
    for (let i = 0; i < MAX_SIZE_PORTAL; i++) {
        nullpos.addSelf(Vector.YN)
        const block = world.getBlock(nullpos)
        if (block?.id == frame_block_id) {
            break
        }
    }
    nullpos.addSelf(Vector.YP)
    if (!await createPortal(nullpos, DIRECTION.NORTH)) {
        if (!await createPortal(nullpos, DIRECTION.WEST)) {
            return false
        }
    }

    return true
}

async function useFlintAndSteel(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions) {

    if (!world_material || !current_inventory_item || (current_inventory_item.id != BLOCK.FLINT_AND_STEEL.id)) {
        return false;
    }

    const position = new Vector(pos);
    position.addSelf(pos.n);

    actions.addPlaySound({tag: 'madcraft:fire', action: 'flint_and_steel_click', pos: position, except_players: [player.session.user_id]});

    // детонатация tnt
    if (!e.shiftKey && world_block.id == BLOCK.TNT.id) {
        actions.addPlaySound({tag: 'madcraft:block.player', action: 'fuse', pos: new Vector(pos), except_players: [player.session.user_id]});
        actions.addBlocks([{pos: new Vector(pos), item: {id: BLOCK.TNT.id, extra_data:{explode: true, fuse: 0}}, action_id: ServerClient.BLOCK_ACTION_REPLACE}]);
        return true;
    }

    // поджигаем блок
    const air_block = world.getBlock(position);
    if (pos.n.y != -1 && air_block.id == BLOCK.AIR.id && air_block.fluid == 0) {
        const extra_data : any = {age: 0};
        let block = world.getBlock(position.offset(1, 0, 0));
        extra_data.east = (block?.material?.flammable) ? true : false;
        block = world.getBlock(position.offset(-1, 0, 0));
        extra_data.west = (block?.material?.flammable) ? true : false;
        block = world.getBlock(position.offset(0, 0, 1));
        extra_data.north = (block?.material?.flammable) ? true : false;
        block = world.getBlock(position.offset(0, 0, -1));
        extra_data.south = (block?.material?.flammable) ? true : false;
        block = world.getBlock(position.offset(0, -1, 0));
        extra_data.up = (block.id != BLOCK.AIR.id && block.id != BLOCK.FIRE.id) ? true : false;
        actions.addBlocks([{pos: position, item: {id: BLOCK.FIRE.id, extra_data: extra_data}, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
        return true;
    }

    return false;

}

// работа с компостером
function putInComposter(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    const bm = world.block_manager
    if (!world_material || world_material.id != bm.COMPOSTER.id)  {
        return false
    }
    const position = new Vector(pos)
    const level = extra_data.level
    if (level > 5) {
        actions.addPlaySound({tag: 'madcraft:block.cloth', action: 'dig', pos: position, except_players: [player.session.user_id]})
        actions.addDropItem({pos: position.offset(0, 0.5, 0), items: [{id: bm.BONE_MEAL.id, count: 1}], force: true});
        actions.addBlocks([{pos: position, item: { id: bm.COMPOSTER.id, extra_data: { level: 0 } }, action_id: ServerClient.BLOCK_ACTION_MODIFY}])
        return true
    }
    if (!mat_block?.composter_chance)  {
        return false
    }
    actions.addParticles([{type: 'villager_happy', pos: position.offset(0, 0.5, 0), area: false}])
    actions.decrement = true
    if (Math.random() <= mat_block.composter_chance) {
        actions.addBlocks([{pos: position, item: { id: bm.COMPOSTER.id, extra_data: { level: (level + 1) } }, action_id: ServerClient.BLOCK_ACTION_MODIFY}])
        // @todo нужные правльные звуки
        actions.addPlaySound({tag: 'madcraft:block.cloth', action: 'dig', pos: position, except_players: [player.session.user_id]})
    } else {
        actions.addPlaySound({tag: 'madcraft:block.cloth', action: 'place', pos: position, except_players: [player.session.user_id]})
    }
    return true
}

// добавление ламинарии вручную
function putKelp(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
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
function putPlate(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if (!world_material || !mat_block || mat_block.style_name != 'cover') {
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
        const data : any = {};
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
function openFenceGate(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if (!world_material || world_material.style_name != 'fence_gate') {
        return false;
    }
    if(!extra_data) {
        extra_data = {};
    }
    if (rotate.x == 0 || rotate.x == 2) {
        extra_data.facing = (pos.z - player.pos.z) > 0 ? 'north' : 'south';
    } else {
        extra_data.facing = (pos.x - player.pos.x) > 0 ? 'east' : 'west';
    }
    extra_data.opened = extra_data && !extra_data.opened;
    if(world_material.sound) {
        actions.addPlaySound({tag: world_material.sound, action: 'open', pos: new Vector(pos), except_players: [player.session.user_id]});
    }
    actions.addBlocks([{pos: new Vector(pos), item: {id: world_material.id, rotate, extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
    return true;
}

// Open door
function openDoor(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
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
    actions.addBlocks([{pos: new Vector(pos), item: {id: world_material.id, rotate, extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
    // Если блок имеет пару (двери)
    if(world_material.has_head) {
        const head_pos = new Vector(world_material.has_head.pos);
        if(extra_data.is_head) {
            head_pos.multiplyScalarSelf(-1);
        }
        const connected_pos = new Vector(pos).addSelf(head_pos);
        const block_connected = world.getBlock(connected_pos);
        if(block_connected.id == world_material.id) {
            block_connected.extra_data.opened = extra_data.opened;
            actions.addBlocks([{pos: connected_pos, item: {id: block_connected.id, rotate, extra_data: block_connected.extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
        }
    }
    return true;
}

// Remove plant from pot
function removeFromPot(e, world, pos, player, world_block, world_material, mat_block, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if(world_material && world_material.tags.includes('pot')) {
        if(extra_data?.item) {
            extra_data = extra_data ? extra_data : {};
            const drop_item = extra_data?.item;
            drop_item.count = 1;
            delete(extra_data.item);
            actions.addBlocks([{pos: new Vector(pos), item: {id: world_block.id, rotate, extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
            actions.addPlaySound({tag: 'madcraft:block.cloth', action: 'hit', pos: new Vector(pos), except_players: [player.session.user_id]});
            // Create drop item
            actions.addDropItem({pos: world_block.posworld.clone().addScalarSelf(.5, 0, .5), items: [drop_item], force: true});
            return true;
        }
    }
    return false;
}

// Посадить растения можно только на блок земли
function restrictPlanting(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions, orientation): boolean {
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
        if(![BLOCK.DIRT.id, BLOCK.SAND.id, BLOCK.GRAVEL.id, BLOCK.GRASS_BLOCK.id, BLOCK.GRASS_BLOCK_SLAB.id].includes(underBlock.id)) {
            return true
        }
    }
    // дикие семена
    if(mat_block.id == BLOCK.SWEET_BERRY_BUSH.id && [BLOCK.PODZOL.id, BLOCK.COARSE_DIRT.id, BLOCK.DIRT.id, BLOCK.GRASS_BLOCK.id, BLOCK.GRASS_BLOCK_SLAB.id, BLOCK.FARMLAND.id, BLOCK.FARMLAND_WET.id].includes(underBlock.id)) {
        return false
    }
    if(![BLOCK.GRASS_BLOCK.id, BLOCK.GRASS_BLOCK_SLAB.id, BLOCK.FARMLAND.id, BLOCK.FARMLAND_WET.id].includes(underBlock.id)) {
        return true;
    }
    // Посадить семена можно только на вспаханную землю
    if(mat_block.seeds && ![BLOCK.FARMLAND.id, BLOCK.FARMLAND_WET.id].includes(underBlock.id)) {
        return true;
    }
    return false;
}

//
function setOnWater(e, world, pos, player, world_block : TBlock, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if(!mat_block || !mat_block.tags.includes('set_on_water') || mat_block.spawn_egg) {
        return false;
    }
    if(world_block.isWater) {
        const position = new Vector(pos);
        position.addSelf(pos.n);
        const block_air = world.getBlock(position.add(pos.n));
        if (block_air.id == BLOCK.AIR.id && block_air.fluid === 0) {
            actions.decrement = true
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
function restrictOnlyFullFace(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions, orientation): boolean {
    if(mat_block.tags.includes('set_only_fullface')) {
        const underBlock = world.getBlock(new Vector(pos.x, pos.y - 1, pos.z));
        if(!underBlock || underBlock.material.transparent) {
            return true;
        }
    }
    return false;
}

// Проверка места под лестницу/лианы
function restrictLadder(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions, orientation): boolean {
    if(['ladder'].indexOf(mat_block.style_name) < 0) {
        return false;
    }
    // Лианы можно ставить на блоки с прозрачностью
    if(world_material.transparent && world_material.style_name != DEFAULT_STYLE_NAME) {
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
                    pos2 = pos2.add(Vector.ZP);
                    break;
                }
                case ROTATE.W: {
                    pos2 = pos2.add(Vector.XP);
                    break;
                }
                case ROTATE.N: {
                    pos2 = pos2.add(Vector.ZN);
                    break;
                }
                case ROTATE.E: {
                    pos2 = pos2.add(Vector.XN);
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
function restrictTorch(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions, orientation): boolean {
    if(mat_block.style_name != 'torch') {
        return false
    }
    let resp = !replace_block && (
        (pos.n.y < 0) ||
        !(world_block.canPlaceOnTopOrBottom(true))
    )
    if(!resp && pos.n.y == 0) {
        resp = !(
            world_material.is_solid || world_material.is_simple_qube
        )
    }
    return resp
}

// use cauldron
function useCauldron(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if (world_block.id != BLOCK.CAULDRON.id) {
        return false;
    }
    const updateCauldron = (lava, water, snow, level) => {
        actions.addBlocks([{
            pos: position,
            item: {
                id: BLOCK.CAULDRON.id,
                extra_data: {
                    level: level,
                    lava: lava,
                    water: water,
                    snow: snow
                }
            },
            action_id: ServerClient.BLOCK_ACTION_MODIFY
        }]);
    }
    const position = new Vector(pos);
    if (current_inventory_item.id == BLOCK.WATER_BOTTLE.id && extra_data.level < 3) {
        actions.decrement = true;
        updateCauldron(false, true, false, extra_data.level + 1);
        return true;
    }
    if (current_inventory_item.id == BLOCK.WATER_BUCKET.id) {
        actions.decrement = true;
        updateCauldron(false, true, false, 3);
        return true;
    }
    if (current_inventory_item.id == BLOCK.LAVA_BUCKET.id) {
        actions.decrement = true;
        updateCauldron(true, false, false, 3);
        return true;
    }
    if (current_inventory_item.id == BLOCK.BUCKET_POWDER_SNOW.id) {
        actions.decrement = true;
        updateCauldron(false, false, true, 3);
        return true;
    }
    if (current_inventory_item.id == BLOCK.BUCKET.id && extra_data.level == 3 && (extra_data.lava == true || extra_data.water == true || extra_data.snow == true) ) {
        const item = {
            id: BLOCK.WATER_BUCKET.id,
            count: 1
        };
        if (extra_data.lava) {
            item.id = BLOCK.LAVA_BUCKET.id;
        }
        if (extra_data.snow) {
            item.id = BLOCK.BUCKET_POWDER_SNOW.id;
        }
        actions.putInBucket(item);
        updateCauldron(false, false, false, 0);
        return true;
    }
    if (current_inventory_item.id == BLOCK.GLASS_BOTTLE.id && extra_data.level > 0 && extra_data.water == true) {
        const item = {
            id: BLOCK.WATER_BOTTLE.id,
            count: 1
        };
        actions.putInBottle(item);
        const level = extra_data.level - 1;
        updateCauldron(false, level == 0 ? false : true, false, level);
        return true;
    }

    return false;
}

// use shears
function useShears(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
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
function useTorch(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if(!mat_block || mat_block.style_name != 'torch') {
        return false;
    }
    if(world_material.name == 'CAMPFIRE' || world_material.style_name == 'candle') {
        extra_data = extra_data || {};
        extra_data.active = true;
        actions.addBlocks([{pos: world_block.posworld.clone(), item: {id: world_material.id, rotate, extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
        return true;
    }
    return false;
}

//
function useShovel(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if(mat_block.item.name != 'instrument' || mat_block.item.instrument_id != 'shovel') {
        return false;
    }
    if(world_material.id == BLOCK.GRASS_BLOCK.id || world_material.id == BLOCK.DIRT.id) {
        const extra_data = null;
        actions.addBlocks([{pos: new Vector(pos), item: {id: BLOCK.DIRT_PATH.id, rotate, extra_data}, action_id: ServerClient.BLOCK_ACTION_REPLACE}]);
        actions.decrement = true;
        if(mat_block.sound) {
            actions.addPlaySound({tag: mat_block.sound, action: 'place', pos: new Vector(pos), except_players: [player.session.user_id]});
        }
        return true;
    }
    if(world_material.name == 'CAMPFIRE') {
        extra_data.active = false;
        actions.addBlocks([{pos: world_block.posworld.clone(), item: {id: world_material.id, rotate, extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
        return true;
    }
    return false;
}

//
function useHoe(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if(mat_block.item.name != 'instrument' || mat_block.item.instrument_id != 'hoe') {
        return false;
    }
    if(world_material.id == BLOCK.GRASS_BLOCK.id || world_material.id == BLOCK.DIRT_PATH.id || world_material.id == BLOCK.DIRT.id) {
        const extra_data = null;
        actions.addBlocks([{pos: new Vector(pos), item: {id: BLOCK.FARMLAND.id, rotate, extra_data}, action_id: ServerClient.BLOCK_ACTION_REPLACE}]);
        actions.decrement = true;
        if(mat_block.sound) {
            actions.addPlaySound({tag: mat_block.sound, action: 'place', pos: new Vector(pos), except_players: [player.session.user_id]});
        }
        return true;
    }
    return false;
}

// Use axe for make stripped logs
function useAxe(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if(!world_material || mat_block.item.name != 'instrument' || mat_block.item.instrument_id != 'axe') {
        return false;
    }
    if(world_material.tags.includes('log') && world_material.stripped_log) {
        const stripped_block = BLOCK.fromName(world_material.stripped_log);
        if(!stripped_block.is_dummy) {
            actions.addBlocks([{pos: new Vector(pos), item: {id: stripped_block.id, rotate: world_block.rotate, extra_data: world_block.extra_data}, action_id: ServerClient.BLOCK_ACTION_REPLACE}]);
            if(mat_block.sound) {
                actions.addPlaySound({tag: mat_block.sound, action: 'strip', pos: new Vector(pos), except_players: [player.session.user_id]});
            }
            return true;
        }
    }
    return false;
}

function growHugeMushroom(world, pos, world_material, actions) {

    const min_max = [5, 7];
    const spice = 3423433;
    var height = SpatialDeterministicRandom.intRange(world, pos, min_max[0], min_max[1], spice);
    if (SpatialDeterministicRandom.float(world, pos, spice) < 0.5) {
        height = height * 2 - 1;
    }
    const isRed = world_material.id === BLOCK.RED_MUSHROOM.id;

    actions.generateTree({
        pos,
        block: {
            extra_data: {
                style: isRed ? 'red_mushroom' : 'brown_mushroom',
                height
            },
            effects: true
        }
    });

    actions.decrement_extended = { mode: 'count' };

    actions.addParticles([{ type: 'villager_happy', pos: pos }]);
}

// Use bone meal
function useBoneMeal(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions: WorldAction): boolean {
    if(mat_block.item.name != 'bone_meal' || !world_material) {
        return false;
    }
    const position = new Vector(pos);
    if(world_material.id == BLOCK.GRASS_BLOCK.id || world_material.id == BLOCK.GRASS_BLOCK_SLAB.id) {
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
                    if(tblock.id == BLOCK.GRASS_BLOCK.id || tblock.id == BLOCK.GRASS_BLOCK_SLAB.id) {
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
    } else if([BLOCK.BROWN_MUSHROOM.id, BLOCK.RED_MUSHROOM.id].includes(world_material.id)) {
        // maybe put it inside "if (Qubatch.is_server) {"
        growHugeMushroom(world, pos, world_material, actions);
        return true;
    } else if (world_block?.material?.ticking?.type && extra_data) {
        if (world_block.material.ticking.type == 'stage' && !extra_data?.notick) {
            extra_data.bone = Math.random() < 0.5 ? 1 : 2;
            actions.addBlocks([{pos: position, item: {id: world_block.id, extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
            actions.decrement = true;
            actions.addParticles([{type: 'villager_happy', pos: position}]);
            actions.addPlaySound({tag: mat_block.sound, action: 'place', pos: position, except_players: [player.session.user_id]});
            return true;
        }
    }
    return false;
}

// "Наслаивание" блока друг на друга, при этом блок остается 1, но у него увеличивается высота (максимум до 1)
function increaseLayering(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    //
    const pos_n = pos.n
    if(pos_n.y == 0) {
        return false
    }
    pos = new Vector().copyFrom(pos)
    //
    const block_touched = world.getBlock(pos);
    if((block_touched?.id == mat_block.id) && mat_block.is_layering) {
        // ok
    } else {
        pos.x += pos_n.x;
        pos.y += pos_n.y;
        pos.z += pos_n.z;
        const block_on_posn = world.getBlock(pos);
        if((block_on_posn?.id == mat_block.id) && mat_block.is_layering) {
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
        return false
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
        actions.addBlocks([{pos: new Vector(pos), item: {id: world_material.id, rotate, extra_data: new_extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
        actions.addPlaySound({tag: world_material.sound, action: 'place', pos: new Vector(pos), except_players: [player.session.user_id]});
    } else {
        if(layering.full_block_name) {
            // replace to full block
            const full_block = BLOCK.fromName(layering.full_block_name);
            actions.addBlocks([{pos: new Vector(pos), item: {id: full_block.id}, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
            actions.addPlaySound({tag: full_block.sound, action: 'place', pos: new Vector(pos), except_players: [player.session.user_id]});
        } else {
            actions.addBlocks([{pos: new Vector(pos), item: {id: world_material.id, rotate, extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
            actions.addPlaySound({tag: world_material.sound, action: 'place', pos: new Vector(pos), except_players: [player.session.user_id]});
        }
    }
    actions.reset_mouse_actions = true;
    actions.decrement = true;
    return true;
}

// Add few count (candles | petals)
function addFewCount(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {

    const add = (style_name, property_name, max_count, sound_tag) => {
        const can_add = !e.shiftKey &&
                    (world_material && (world_material.style_name == style_name)) &&
                    (current_inventory_item && current_inventory_item.id == world_material.id);
        if(!can_add) {
            return false;
        }
        if(!extra_data || typeof extra_data[property_name] == 'undefined') {
            extra_data = {};
            extra_data[property_name] = 1
        }
        if((property_name in extra_data) && extra_data[property_name] < max_count) {
            extra_data[property_name]++;
            actions.addBlocks([{pos: new Vector(pos), item: {id: world_material.id, rotate, extra_data}, action_id: ServerClient.BLOCK_ACTION_MODIFY}]);
            actions.addPlaySound({tag: sound_tag, action: 'hit', pos: new Vector(pos), except_players: [player.session.user_id]});
            actions.reset_mouse_actions = true;
            actions.decrement = true;
        }
        return true;
    }

    // candles
    if(add('candle', 'candles', 4, 'madcraft:block.cloth')) {
        return true
    // petals
    } else if(add('petals', 'petals', 4, 'madcraft:block.cloth')) {
        return true
    }

    return false

}

// Place rail
function prePlaceRail(world, pos, new_item, actions) {
    return RailShape.place(world, pos, new_item, actions);
}

// Set furniture upholstery
function setFurnitureUpholstery(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if(mat_block.tags.includes('wool')) {
        if(['chair', 'stool'].includes(world_material.style_name)) {
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
            actions.decrement = true;
            return true;
        }
    }
    return false;
}

// Remove furniture upholstery
function removeFurnitureUpholstery(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if(world_material && ['chair', 'stool'].includes(world_material.style_name)) {
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
            actions.addDropItem({pos: world_block.posworld.clone().addScalarSelf(.5, .5, .5), items: [drop_item], force: true});
            return true;
        }
    }
    return false;
}

function setPointedDripstone(e, world, pos, player, world_block, world_material, mat_block : IBlockMaterial, current_inventory_item, extra_data, rotate, replace_block, actions): boolean {
    if (!world_material || !mat_block || (mat_block.id != BLOCK.POINTED_DRIPSTONE.id)) {
        return false;
    }
    const position = new Vector(pos);
    if (world_block.id == BLOCK.POINTED_DRIPSTONE.id) {
        const up = world_block.extra_data.up;
        const air_pos = position.offset(0, up ? -1 : 1, 0);
        const block = world.getBlock(air_pos);
        if (block.id == BLOCK.AIR.id && block.fluid == 0) {
            actions.addBlocks([{pos: air_pos, item: {id: BLOCK.POINTED_DRIPSTONE.id, extra_data: {up: up}}, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
        }
    } else {
        if (pos.n.y == 1) {
            actions.addBlocks([{pos: position.offset(0, 1, 0), item: {id: BLOCK.POINTED_DRIPSTONE.id, extra_data: {up: false}}, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
        }
        if (pos.n.y == -1) {
            actions.addBlocks([{pos: position.offset(0, -1, 0), item: {id: BLOCK.POINTED_DRIPSTONE.id, extra_data: {up: true}}, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
        }
    }

    return true;
}