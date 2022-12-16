import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "./chunk_const.js";
import { DIRECTION, DIRECTION_BIT, ROTATE, TX_CNT, Vector, Vector4 } from './helpers.js';
import { ResourcePackManager } from './resource_pack_manager.js';
import { Resources } from "./resources.js";
import { CubeSym } from "./core/CubeSym.js";
import { AABB } from './core/AABB.js';

import { default as StyleStairs } from './block_style/stairs.js';

export const TRANS_TEX                      = [4, 12];
export const WATER_BLOCKS_ID                = [200, 202, 415];
export const INVENTORY_STACK_DEFAULT_SIZE   = 64;
export const POWER_NO                       = 0;

// Свойства, которые могут сохраняться в БД
export const ITEM_DB_PROPS                  = ['power', 'count', 'entity_id', 'extra_data', 'rotate'];
export const ITEM_INVENTORY_PROPS           = ['power', 'count', 'entity_id', 'extra_data'];
export const ITEM_INVENTORY_KEY_PROPS       = ['power', 'extra_data'];

export const LEAVES_TYPE = {NO: 0, NORMAL: 1, BEAUTIFUL: 2};

let aabb = new AABB();
let shapePivot = new Vector(.5, .5, .5);

export let NEIGHB_BY_SYM = {};
NEIGHB_BY_SYM[DIRECTION.FORWARD] = 'NORTH';
NEIGHB_BY_SYM[DIRECTION.BACK] = 'SOUTH';
NEIGHB_BY_SYM[DIRECTION.LEFT] = 'WEST';
NEIGHB_BY_SYM[DIRECTION.RIGHT] = 'EAST';
NEIGHB_BY_SYM[DIRECTION.DOWN] = 'DOWN';
NEIGHB_BY_SYM[DIRECTION.UP] = 'UP';

// BLOCK PROPERTIES:
// fluid (bool)                 - Is fluid
// gravity (bool)               - May fall
// id (int)                     - Unique ID
// instrument_id (string)       - Unique code of instrument type
// inventory_icon_id (int)      - Position in inventory atlas
// max_in_stack (int)           - Max count in inventory or other stack
// name (string)                - Unique name
// passable (float)             - Passable value 0...1
// selflit (bool)               - ?
// sound (string)               - Resource ID
// spawnable (bool)             - Cannot be /give for player
// style (string)               - used for drawing style (cube, fence, ladder, plant, pane, sign, slab, stairs)
// tags (string[])              - Array of string tags
// texture (array | function)   - ?
// transparent (bool)           - Not cube

class Block {

    constructor() {}

}

//
export class FakeTBlock {

    constructor(id, extra_data, pos, rotate, pivot, matrix, tags, biome, dirt_color) {
        this.id = id;
        this.extra_data = extra_data;
        this.pos = pos;
        this.rotate = rotate;
        this.pivot = pivot;
        this.matrix = matrix;
        this.tags = tags;
        this.biome = biome;
        this.dirt_color = dirt_color;
    }

    getCardinalDirection() {
        return BLOCK.getCardinalDirection(this.rotate);
    }

    get posworld() {
        return this.pos;
    }

    hasTag(tag) {
        const mat = this.material;
        if(!mat) {
            return false;
        }
        if(!Array.isArray(mat.tags)) {
            return false;
        }
        let resp = mat.tags.includes(tag);
        if(!resp && this.tags) {
            resp = this.tags.includes(tag);
        }
        return resp;
    }

    get material() {
        return BLOCK.fromId(this.id);
    }

}

//
export class DropItemVertices extends FakeTBlock {

    constructor(id, extra_data, pos, rotate, matrix, vertice_groups) {
        super(id, extra_data, pos, rotate, null, matrix, null, null, null);
        this.vertice_groups = vertice_groups;
    }

}

//
class Block_Material {

    static materials = {
        data: null,
        checkBlock: async function(resource_pack, block) {
            if(block.material && block.material instanceof Block_Material) {
                return;
            }
            if(!this.data) {
                this.data = await Resources.loadMaterials();
            }
            if(!block.material || !('id' in block.material)) {
                throw 'error_block_has_no_material|' + resource_pack.id + '.' + block.name;
            }
            //
            if(block.item?.instrument_id && !this.data.instruments[block.item.instrument_id]) {
                throw 'error_unknown_instrument|' + block.item.instrument_id;
            }
            //
            const block_material_id = block.material.id;
            if(!this.data.list[block_material_id]) {
                throw 'error_invalid_instrument|' + block_material_id;
            }
            block.material = new Block_Material(this.data.list[block_material_id]);
            block.material.id = block_material_id;
            if(typeof block.mining_time !== 'undefined') {
                block.material.mining.time = block.mining_time
            }
        }
    };

    constructor(data) {
        Object.assign(this, JSON.parse(JSON.stringify(data)));
    }

    /**
     * Возвращает время, необходимое для того, чтобы разбить блок
     * @param { Object } instrument
     * @param { Bool } force Фиксированное и ускоренное разбитие (например в режиме креатива)
     * @return float
     */
    getMiningTime(instrument, force) {
        let mining_time = this.mining.time;
        if(force) {
            mining_time = 0;
        } else if(instrument && instrument.material) {
            const instrument_id = instrument.material.item?.instrument_id;
            if(instrument_id) {
                if(this.mining.instruments.indexOf(instrument_id) >= 0) {
                    const instrument_boost = instrument.material.material.mining.instrument_boost;
                    if(typeof instrument_boost !== 'undefined' && !isNaN(instrument_boost)) {
                        mining_time = Math.round((mining_time / instrument_boost) * 100) / 100;
                    }
                }
            }
        }
        return mining_time;
    }

}

// getBlockNeighbours
export function getBlockNeighbours(world, pos) {
    let v = new Vector(0, 0, 0);
    return {
        UP:     world.getBlock(v.set(pos.x, pos.y + 1, pos.z)),
        DOWN:   world.getBlock(v.set(pos.x, pos.y - 1, pos.z)),
        SOUTH:  world.getBlock(v.set(pos.x, pos.y, pos.z - 1)),
        NORTH:  world.getBlock(v.set(pos.x, pos.y, pos.z + 1)),
        WEST:   world.getBlock(v.set(pos.x - 1, pos.y, pos.z)),
        EAST:   world.getBlock(v.set(pos.x + 1, pos.y, pos.z))
    };
}

export class BLOCK {

    static list                     = new Map();
    static styles                   = new Map();
    static spawn_eggs               = [];
    static ao_invisible_blocks      = [];
    static resource_pack_manager    = null;
    static max_id                   = 0;
    static MASK_BIOME_BLOCKS        = [];
    static MASK_COLOR_BLOCKS        = [];
    static SOLID_BLOCK_ID           = [];

    static getBlockTitle(block) {
        if(!block || !('id' in block)) {
            return '';
        }
        let mat = null;
        if('name' in block && 'title' in block) {
            mat = block;
        } else {
            mat = BLOCK.fromId(block.id);
        }
        let resp = mat.name;
        if(mat.title) {
            resp += ` (${mat.title})`;
        }
        resp = resp.replaceAll('_', ' ');
        if(block.extra_data?.label) {
            resp = block.extra_data?.label;
        }
        return resp;
    }

    static getLightPower(material) {
        if (!material) {
            return 0;
        }
        let val = 0;
        if (material.is_water) {
            return 64;
        } else if(material.light_power) {
            val = Math.floor(material.light_power.a / 16.0);
        } else if (!material.transparent) {
            val = 96;
        }
        return val + (material.visible_for_ao ? 128 : 0);
    }

    // Return flat index of chunk block
    static getIndex(x, y, z) {
        if(x instanceof Vector || typeof x == 'object') {
            y = x.y;
            z = x.z;
            x = x.x;
        }
        let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
        return index;
    }

    // Return new simplified item
    static convertItemToDBItem(item) {
        if(!item || !('id' in item)) {
            return null;
        }
        const resp = {
            id: item.id
        };
        for(let k of ITEM_DB_PROPS) {
            let v = item[k];
            if(v !== undefined && v !== null) {
                resp[k] = v;
            }
        }
        return resp;
    }

    // Return new simplified item
    static convertItemToInventoryItem(item, b, no_copy_extra_data = false) {
        if(!item || !('id' in item) || item.id < 0) {
            return null;
        }
        const resp = {
            id: item.id
        };
        if('count' in item) {
            item.count = Math.floor(item.count);
        }
        // fix old invalid instruments power
        if(b && 'power' in b && b.power > 0) {
            if(!item.power) {
                item.power = b.power;
            }
        }
        for(let k of ITEM_INVENTORY_PROPS) {
            if(no_copy_extra_data) {
                if(k == 'extra_data') {
                    continue;
                }
            }
            if(b) {
                if(k in b) {
                    if(k == 'power' && b.power == 0) {
                        continue;
                    }
                }
            }
            let v = item[k];
            if(v !== undefined && v !== null) {
                resp[k] = v;
            }
        }
        return resp;
    }

    //
    static getBlockIndex(x, y, z, v = null) {
        if (x instanceof Vector) {
          y = x.y;
          z = x.z;
          x = x.x;
        }

        // функция евклидового модуля
        const f = (n, m) => ((n % m) + m) % m;

        if (v) {
          v.x = f(x, CHUNK_SIZE_X);
          v.y = f(y, CHUNK_SIZE_Y);
          v.z = f(z, CHUNK_SIZE_Z);
        } else {
          v = new Vector(f(x, CHUNK_SIZE_X), f(y, CHUNK_SIZE_Y), f(z, CHUNK_SIZE_Z));
        }

        return v;
    }

    // Call before setBlock
    static makeExtraData(block, pos, orientation, world) {
        block = BLOCK.BLOCK_BY_ID[block.id];
        const is_trapdoor = block.tags.includes('trapdoor');
        const is_stairs = block.tags.includes('stairs');
        const is_door = block.tags.includes('door');
        const is_slab = block.is_layering && block.layering.slab;
        //
        let extra_data = null;
        const setExtra = (k, v) => {
            extra_data = extra_data || {};
            extra_data[k] = v;
        };
        //
        if(orientation.y == 1 && pos.point) {
            pos.point.y = 0;
        }
        if(is_trapdoor || is_stairs || is_door || is_slab) {
            setExtra('point', pos?.point ? new Vector(pos.point.x, pos.point.y, pos.point.z) : new Vector(0, 0, 0));
            // Trapdoor
            if(is_trapdoor) {
                extra_data.opened = false;
            }
            // Door
            if(is_door) {
                extra_data.opened = false;
                extra_data.left = false;
                if(!pos?.point) {
                    pos.point = new Vector(0, 0, 0);
                }
                switch(orientation.x) {
                    case ROTATE.S: {
                        extra_data.left = pos.point.x < .5;
                        break;
                    }
                    case ROTATE.N: {
                        extra_data.left = pos.point.x >= .5;
                        break;
                    }
                    case ROTATE.W: {
                        extra_data.left = pos.point.z >= .5;
                        break;
                    }
                    case ROTATE.E: {
                        extra_data.left = pos.point.z < .5;
                        break;
                    }
                }
            }
            if(pos.n.y == -1) {
                extra_data.point.y = 1;
            } else if(pos.n.y == -1) {
                extra_data.point.y = 0;
            }
        } else if(block.extra_data) {
            extra_data = JSON.parse(JSON.stringify(block.extra_data));
            extra_data = BLOCK.calculateExtraData(extra_data, pos);
        }
        // facing
        if(extra_data && 'facing' in extra_data) {
            extra_data.facing = BLOCK.getFacing(orientation.x);
        }
        // is_chest
        if(block.is_chest) {
            setExtra('can_destroy', true);
            setExtra('slots', {});
        }
        // is_head
        if(block.has_head) {
            setExtra('is_head', false);
        }
        // if mushroom block
        if(block.is_mushroom_block && world) {
            const neighbours = getBlockNeighbours(world, pos);
            let t = 0;
            if(neighbours.UP && neighbours.UP.material.transparent) t |= (1 << DIRECTION_BIT.UP);
            if(neighbours.DOWN && neighbours.DOWN.material.transparent) t |= (1 << DIRECTION_BIT.DOWN);
            if(neighbours.EAST && neighbours.EAST.material.transparent) t |= (1 << DIRECTION_BIT.EAST);
            if(neighbours.WEST && neighbours.WEST.material.transparent) t |= (1 << DIRECTION_BIT.WEST);
            if(neighbours.SOUTH && neighbours.SOUTH.material.transparent) t |= (1 << DIRECTION_BIT.SOUTH);
            if(neighbours.NORTH && neighbours.NORTH.material.transparent) t |= (1 << DIRECTION_BIT.NORTH);
            if(t != 0) {
                setExtra('t', t);
            }
        }
        return extra_data;
    }

    // Execute calculated extra_data fields
    static calculateExtraData(extra_data, pos) {
        if('calculated' in extra_data) {
            const calculated = extra_data.calculated;
            delete(extra_data.calculated);
            for(let g of calculated) {
                if(!('name' in g)) {
                    throw 'error_generator_name_not_set';
                }
                switch(g.type) {
                    case 'pos': {
                        extra_data[g.name] = new Vector(pos);
                        break;
                    }
                    case 'random_int': {
                        if(!('min_max' in g)) {
                            throw 'error_generator_min_max_not_set';
                        }
                        extra_data[g.name] = Math.floor(Math.random() * (g.min_max[1] - g.min_max[0] + 1) + g.min_max[0]);
                        break;
                    }
                    case 'random_item': {
                        if(!('items' in g)) {
                            throw 'error_generator_items_not_set';
                        }
                        extra_data[g.name] = g.items.length > 0 ? g.items[g.items.length * Math.random() | 0] : null;
                        break;
                    }
                    case 'bees': {
                        extra_data[g.name] = [];
                        const count = Math.floor(Math.random() * (g.min_max[1] - g.min_max[0] + 1) + g.min_max[0]);
                        for(let i = 0; i < count; i++) {
                            extra_data[g.name].push({pollen: 0});
                        }
                        break;
                    }
                }
            }
        }
        return extra_data;
    }

    // Returns a block structure for the given id.
    static fromId(id) {
        const resp = this.BLOCK_BY_ID[id];
        if(resp) {
            return resp;
        }
        console.error('Warning: id missing in BLOCK ' + id);
        return this.DUMMY;
    }

    //
    static getFacing(orientation_x) {
        const facings4 = ['north', 'west', 'south', 'east'];
        if(orientation_x in facings4) {
            return facings4[orientation_x];
        }
        return facings4[0];
    }

    // Returns a block structure for the given id.
    static fromName(name) {
        if(name.indexOf(':') >= 0) {
            name = name.split(':')[1].toUpperCase();
        }
        if(this.hasOwnProperty(name)) {
            return this[name]
        }
        console.error('Warning: name missing in BLOCK ' + name);
        return this.DUMMY;
    }

    // Возвращает True если блок является растением
    static isPlants(id) {
        let b = this.fromId(id);
        return b && !!b.planting;
    }

    // Can replace
    static canReplace(block_id, extra_data, replace_with_block_id) {
        if(block_id == 0) {
            return true;
        }
        if([BLOCK.GRASS.id, BLOCK.STILL_WATER.id, BLOCK.FLOWING_WATER.id, BLOCK.STILL_LAVA.id,
            BLOCK.FLOWING_LAVA.id, BLOCK.CLOUD.id, BLOCK.TALL_GRASS.id, BLOCK.FIRE.id].includes(block_id)) {
            return true;
        }
        const mat = BLOCK.BLOCK_BY_ID[block_id];
        if(mat.is_fluid) {
            return true;
        }
        if(mat.is_layering) {
            const height = extra_data ? (extra_data.height ? parseFloat(extra_data.height) : 1) : mat.height;
            return !isNaN(height) && height == mat.height && block_id != replace_with_block_id;
        }
        return false;
    }

    // Блок может быть уничтожен водой
    static destroyableByWater(block) {
        return block.planting || block.id == this.AIR.id;
    }

    // Стартовый игровой инвентарь
    static getStartInventory() {
        let blocks = [
            Object.assign({count: 5}, this.RED_MUSHROOM),
            Object.assign({count: 64}, this.SAND),
            Object.assign({count: 6}, this.BOOKSHELF),
            Object.assign({count: 20}, this.GLOWSTONE),
            Object.assign({count: 4}, this.TEST)
        ];
        for(let key of Object.keys(blocks)) {
            let b = blocks[key];
            delete(b.texture);
            blocks[key] = b;
        }
        return blocks;
    }

    //
    static isRandomTickingBlock(block_id) {
        return !!BLOCK.fromId(block_id).random_ticker;
    }

    //
    static getBlockStyleGroup(block) {
        let group = 'regular';
        if('group' in block) return block.group;
        // make vertices array
        if (block.is_fluid) {
            if (WATER_BLOCKS_ID.includes(block.id)) {
                group = 'doubleface_transparent';
            } else {
                group = 'doubleface';
            }
        } else
        if((block.tags.includes('alpha')) || ['thin'].includes(block.style)) {
            // если это блок воды или облако
            group = 'doubleface_transparent';
        } else if(block.style == 'pane' || block.is_glass) {
            group = 'transparent';
        } else if(block.tags.includes('doubleface') ||
            [
                'planting', 'chain', 'ladder', 'door', 'redstone', 'pot', 'lantern',
                'azalea', 'bamboo', 'campfire', 'cocoa', 'item_frame', 'candle', 'rails', 'slope', 'cover',
                'lectern'
            ].includes(block.style)
            ) {
            group = 'doubleface';
        }
        return group;
    }

    static reset() {
        BLOCK.spawn_eggs             = [];
        BLOCK.ao_invisible_blocks    = [];
        BLOCK.list                   = new Map();
        BLOCK.BLOCK_BY_ID            = new Array(1024);
        BLOCK.BLOCK_BY_TAGS          = new Map();
        BLOCK.list_arr               = [];
    }

    // parseBlockStyle...
    static parseBlockStyle(block) {
        return block.hasOwnProperty('style') ? block.style : 'default';
    }

    // parseBlockTransparent...
    static parseBlockTransparent(block) {
        let transparent = block.hasOwnProperty('transparent') && !!block.transparent;
        if(block.style && block.style == 'stairs') {
            transparent = true;
        }
        return transparent;
    }

    static isSolid(block) {
        return block.style == 'default' &&
            !block.is_fluid &&
            !block.is_leaves &&
            !['NUM1', 'NUM2'].includes(block.name) &&
            !('width' in block) &&
            !('height' in block);
    }

    /**
     * @param {int} block_id 
     * @returns {boolean}
     */
    static isSolidID(block_id) {
        if(block_id == 0) return false
        return this.SOLID_BLOCK_ID.includes(block_id)
    }

    static isSimpleQube(block) {
        return block.is_solid &&
            !block.can_rotate &&
            block.tags.length == 0 &&
            block.texture &&
            Object.keys(block.texture).length == 1;
    }

    // add
    static async add(resource_pack, block) {
        // Check duplicate ID
        if(!('name' in block) || !('id' in block)) {
            throw 'error_invalid_block';
        }
        const existing_block = this.BLOCK_BY_ID[block.id] || null;
        const replace_block = existing_block && (block.name == existing_block.name);
        const original_props = Object.keys(block);
        if(existing_block) {
            if(replace_block) {
                for(let prop_name in existing_block) {
                    if(original_props.indexOf(prop_name) < 0) {
                        block[prop_name] = existing_block[prop_name];
                    }
                }
            } else {
                console.error('Duplicate block id ', block.id, block);
            }
        }
        // Check block material
        await Block_Material.materials.checkBlock(resource_pack, block);
        if(!block.sound) {
            if(block.id > 0) {
                if(!block.item) {
                    let material_id = null;
                    if(['stone', 'grass', 'wood', 'glass', 'sand'].indexOf(block.material.id) >= 0) {
                        material_id = block.material.id;
                    } else {
                        switch(block.material.id) {
                            case 'ice':
                            case 'netherite':
                            case 'terracota': {
                                material_id = 'stone';
                                break;
                            }
                            case 'plant':
                            case 'dirt':
                            case 'leaves': {
                                material_id = 'grass';
                                break;
                            }
                            default: {
                                // console.log(block.name, block.material.id);
                            }
                        }
                    }
                    if(material_id) {
                        block.sound = `madcraft:block.${material_id}`;
                    }
                }
            }
        }
        //
        block.style             = this.parseBlockStyle(block);
        block.tags              = block?.tags || [];
        // rotate_by_pos_n_xyz
        if(block.tags.includes('rotate_by_pos_n_xyz') || block.tags.includes('rotate_by_pos_n_6') || block.tags.includes('rotate_by_pos_n_12')) {
            block.tags.push('rotate_by_pos_n');
        }
        //
        block.has_window        = !!block.window;
        block.power             = (('power' in block) && !isNaN(block.power) && block.power > 0) ? block.power : POWER_NO;
        block.selflit           = block.hasOwnProperty('selflit') && !!block.selflit;
        block.deprecated        = block.hasOwnProperty('deprecated') && !!block.deprecated;
        block.draw_only_down    = block.tags.includes('draw_only_down');
        block.transparent       = this.parseBlockTransparent(block);
        block.is_water          = !!block.is_fluid && WATER_BLOCKS_ID.includes(block.id);
        block.is_jukebox        = block.tags.includes('jukebox');
        block.is_mushroom_block = block.tags.includes('mushroom_block');
        block.is_button         = block.tags.includes('button');
        block.is_sapling        = block.tags.includes('sapling');
        block.is_battery        = ['car_battery'].includes(block?.item?.name);
        block.is_layering       = !!block.layering;
        block.is_grass          = ['GRASS', 'TALL_GRASS'].includes(block.name);
        block.is_dirt           = ['GRASS_BLOCK', 'DIRT_PATH', 'SNOW_DIRT', 'PODZOL', 'MYCELIUM', 'FARMLAND', 'FARMLAND_WET'].indexOf(block.name) >= 0;
        block.is_leaves         = block.tags.includes('leaves') ? LEAVES_TYPE.NORMAL : LEAVES_TYPE.NO;
        block.is_glass          = block.tags.includes('glass') || (block.material.id == 'glass');
        block.is_sign           = block.tags.includes('sign');
        block.is_banner         = block.style == 'banner';
        // is_chest is used for legacy code compatibility. Don't specify it in the config. Specify chest_slots nstead.
        block.is_chest          = block.chest_slots > 0;
        block.readonly_chest_slots = block.readonly_chest_slots || 0;
        block.has_oxygen        = !(block.is_fluid || (block.id > 0 && block.passable == 0 && !block.transparent));
        // не переносить!
        if(block.is_leaves) {
            const beautiful_leaves = resource_pack?.manager?.settings?.beautiful_leaves;
            if(beautiful_leaves) {
                block.is_leaves = LEAVES_TYPE.BEAUTIFUL;
                block.tags.push('doubleface');
            }
        }
        block.group             = this.getBlockStyleGroup(block);
        block.planting          = ('planting' in block) ? block.planting : (block.material.id == 'plant');
        block.resource_pack     = resource_pack;
        block.material_key      = BLOCK.makeBlockMaterialKey(resource_pack, block);
        block.can_rotate        = 'can_rotate' in block ? block.can_rotate : block.tags.filter(x => ['trapdoor', 'stairs', 'door', 'rotate_by_pos_n'].indexOf(x) >= 0).length > 0;
        block.tx_cnt            = BLOCK.calcTxCnt(block);
        block.uvlock            = !('uvlock' in block) ? true : false;
        block.invisible_for_cam = block.is_portal || block.passable > 0 || (block.material.id == 'plant' && block.style == 'planting') || block.style == 'ladder' || block?.material?.id == 'glass';
        block.invisible_for_rain= block.is_grass || block.is_sapling || block.is_banner || block.style == 'planting';
        block.can_take_shadow   = BLOCK.canTakeShadow(block);
        block.random_rotate_up  = block.tags.includes('random_rotate_up');
        block.is_solid          = this.isSolid(block);
        block.is_solid_for_fluid= block.tags.includes('is_solid_for_fluid') ||
                                    block.tags.includes('stairs') ||
                                    ['wall', 'pane'].includes(block.style);

        block.is_simple_qube    = this.isSimpleQube(block);
        block.can_interact_with_hand = this.canInteractWithHand(block);
        //
        if(block.planting && !('inventory_style' in block)) {
            block.inventory_style = 'extruder';
        }
        if(block.is_solid) {
            BLOCK.SOLID_BLOCK_ID.push(block.id)
        }
        // Set default properties
        let default_properties = {
            light:              null,
            texture_animations: null,
            passable:           0,
            spawnable:          true,
            max_in_stack:       INVENTORY_STACK_DEFAULT_SIZE
        };
        for(let [k, v] of Object.entries(default_properties)) {
            if(!block.hasOwnProperty(k)) {
                block[k] = v;
            }
        }
        //
        block.drop_if_unlinked  = block.style == 'torch';
        block.can_auto_drop     = !block.previous_part &&
                                  !block.deprecated &&
                                  block.spawnable &&
                                  !block.is_fluid &&
                                  [31, 572].indexOf(block.id) < 0;
        // Add to ao_invisible_blocks list
        if(block.planting || block.style == 'fence' || block.style == 'wall' || block.style == 'pane' || block.style == 'ladder' || block.light_power || block.tags.includes('no_drop_ao')) {
            if(!this.ao_invisible_blocks.includes(block.id)) {
                this.ao_invisible_blocks.push(block.id);
            }
        }
        // Calculate in last time, after all init procedures
        block.visible_for_ao = BLOCK.visibleForAO(block);
        block.light_power_number = BLOCK.getLightPower(block);
        // Append to collections
        if(replace_block) {
            original_props.push('resource_pack');
            original_props.push('material_key');
            original_props.push('tx_cnt');
            for(let prop_name of original_props) {
                existing_block[prop_name] = block[prop_name];
            }
            block = existing_block;
        } else {
            this[block.name] = block;
            BLOCK.BLOCK_BY_ID[block.id] = block;
            this.list.set(block.id, block);
        }
        // After add works
        // Add spawn egg
        if(block.spawn_egg && BLOCK.spawn_eggs.indexOf(block.id) < 0) {
            BLOCK.spawn_eggs.push(block.id);
        }
        if(block.tags.includes('mask_biome') && !BLOCK.MASK_BIOME_BLOCKS.includes(block.id)) {
            BLOCK.MASK_BIOME_BLOCKS.push(block.id)
        }
        if(block.tags.includes('mask_color') && !BLOCK.MASK_COLOR_BLOCKS.includes(block.id)) {
            BLOCK.MASK_COLOR_BLOCKS.push(block.id)
        }
        // Parse tags
        for(let tag of block.tags) {
            if(!this.BLOCK_BY_TAGS.has(tag)) {
                this.BLOCK_BY_TAGS.set(tag, new Map());
            }
            this.BLOCK_BY_TAGS.get(tag).set(block.id, block);
        }
        // Max block ID
        if(block.id > this.max_id) {
            this.max_id = block.id;
        }
    }

    // Return true if block can intaract with hand
    static canInteractWithHand(block) {
        return block.tags.includes('door') ||
            block.tags.includes('trapdoor') ||
            block.tags.includes('pot') ||
            block.is_button ||
            block.is_jukebox ||
            block.window ||
            ['stool', 'chair'].includes(block.style);
    }

    // Make material key
    static makeBlockMaterialKey(resource_pack, material) {
        let mat_group = material.group;
        let texture_id = 'default';
        let mat_shader = 'terrain';
        if(typeof material.texture == 'object' && 'id' in material.texture) {
            texture_id = material.texture.id;
        }
        return `${resource_pack.id}/${mat_group}/${mat_shader}/${texture_id}`;
    }

    //
    static canTakeShadow(mat) {
        if(mat.id < 1 || !mat) {
            return false;
        }
        const is_slab = !!mat.is_layering;
        const is_bed = mat.style == 'bed';
        const is_dirt = mat.tags.includes('dirt');
        const is_carpet = mat.tags.includes('carpet');
        const is_farmland = mat.name.indexOf('FARMLAND') == 0;
        if(mat?.transparent && !is_slab && !is_bed && !is_dirt && !is_farmland && !is_carpet) {
            return false;
        }
        return true;
    }

    // Return tx_cnt from resource pack texture
    static calcTxCnt(material) {
        let tx_cnt = TX_CNT;
        if (typeof material.texture === 'object' && 'id' in material.texture) {
            let tex = material.resource_pack.conf.textures[material.texture.id];
            if(tex && 'tx_cnt' in tex) {
                tx_cnt = tex.tx_cnt;
            }
        } else {
            let tex = material.resource_pack.conf.textures['default'];
            if(tex && 'tx_cnt' in tex) {
                tx_cnt = tex.tx_cnt;
            }
        }
        return tx_cnt;
    }

    // getAll
    static getAll() {
        return this.list_arr;
    }

    static isSpawnEgg(block_id) {
        return BLOCK.spawn_eggs.includes(block_id);
    }

    // Возвращает координаты текстуры с учетом информации из ресурс-пака
    static calcMaterialTexture(material, dir, width, height, block, force_tex, random_double) {

        let mat_texture = material?.texture
        if(material?.texture_variants && (random_double != undefined)) {
            mat_texture = material.texture_variants[Math.floor(material.texture_variants.length * random_double)]
        }

        const tx_cnt = force_tex?.tx_cnt || material.tx_cnt;
        let texture = force_tex || mat_texture;
        // Stages
        if(block && material.stage_textures && block && block.extra_data) {
            if('stage' in block.extra_data) {
                let stage = block.extra_data.stage;
                stage = Math.max(stage, 0);
                stage = Math.min(stage, material.stage_textures.length - 1);
                texture = material.stage_textures[stage];
            }
        }
        // Mushroom block
        if(material.is_mushroom_block) {
            let t = block?.extra_data?.t;
            if(block && t) {
                texture = mat_texture.down;
                if(dir == DIRECTION.UP && (t >> DIRECTION_BIT.UP) % 2 != 0) texture = mat_texture.side;
                if(dir == DIRECTION.DOWN && (t >> DIRECTION_BIT.DOWN) % 2 != 0) texture = mat_texture.side;
                if(dir == DIRECTION.WEST && (t >> DIRECTION_BIT.WEST) % 2 != 0) texture = mat_texture.side;
                if(dir == DIRECTION.EAST && (t >> DIRECTION_BIT.EAST) % 2 != 0) texture = mat_texture.side;
                if(dir == DIRECTION.NORTH && (t >> DIRECTION_BIT.NORTH) % 2 != 0) texture = mat_texture.side;
                if(dir == DIRECTION.SOUTH && (t >> DIRECTION_BIT.SOUTH) % 2 != 0) texture = mat_texture.side;
            } else {
                texture = mat_texture.down;
            }
        }
        // @todo (BEE NEST) убрать отсюда куда нибудь
        if(block && block.id == 1447 && dir == DIRECTION.FORWARD && block.extra_data && 'pollen' in block.extra_data && block.extra_data.pollen >= 4) {
            texture = mat_texture.north_honey;
        }
        let c = this.calcTexture(texture, dir, tx_cnt);
        if(width && width < 1) {
            c[2] *= width;
        }
        if(height && height < 1) {
            c[1] += 0.5 / tx_cnt - height / tx_cnt / 2;
            c[3] *= height;
        }
        // if pointed_dripstone
        if(block && material?.name == 'POINTED_DRIPSTONE') {
            let dir = block?.extra_data?.dir;
            if(dir) {
                if(dir != -1) {
                    c[3] *= -1;
                }
            }
        }
        return c;
    }

    // getAnimations...
    static getAnimations(material, side) {
        if(!material.texture_animations) {
            return 0;
        }
        if(side in material.texture_animations) {
            return material.texture_animations[side] | 0;
        } else if('side' in material.texture_animations) {
            return material.texture_animations['side'] | 0;
        }
        return 0;
    }

    // Возвращает координаты текстуры
    static calcTexture(c, dir, tx_cnt) {
        if(typeof tx_cnt == 'undefined') {
            tx_cnt = TX_CNT;
        }
        if (c instanceof Array) {
            // do nothing
        } else if(c instanceof Function) {
            c = c(dir);
        } else if (typeof c === 'object' && c !== null) {
            let prop = null;
            switch(dir) {
                case DIRECTION.UP: {prop = 'up'; break;}
                case DIRECTION.DOWN: {prop = 'down'; break;}
                case DIRECTION.LEFT: {prop = 'west'; break;}
                case DIRECTION.RIGHT: {prop = 'east'; break;}
                case DIRECTION.FORWARD: {prop = 'north'; break;}
                case DIRECTION.BACK: {prop = 'south'; break;}
                default: {prop = dir;}
            }
            if(c.hasOwnProperty(prop)) {
                c = c[prop];
            } else if(c.hasOwnProperty('side')) {
                c = c.side;
            } else {
                throw 'Invalid texture prop `' + prop + '`';
            }
        }
        if(!c) {
            debugger;
        }
        const flags = c[2] | 0;
        const size = c[3] ?? 1;
        return [
            (c[0] + size/2) / tx_cnt,
            (c[1] + size/2) / tx_cnt,
            ((flags & 1) != 0) ? - size / tx_cnt : size / tx_cnt,
            ((flags & 2) != 0)  ? - size / tx_cnt : size / tx_cnt
        ];
    }

    // Функция определяет, отбрасывает ли указанный блок тень
    static visibleForAO(block) {
        if(!block) return false;
        if(typeof block == 'undefined') return false;
        let block_id = block;
        if(typeof block !== 'number') {
            block_id = block.id;
        }
        if(block_id < 1) return false;
        if(this.ao_invisible_blocks.includes(block_id)) return false;
        return true;
    }

    // Return inventory icon pos
    static getInventoryIconPos(
        inventory_icon_id,
        inventory_image_size = 2048,
        frameSize = 128
    ) {
        const w = frameSize;
        const h = frameSize;
        const icons_per_row = inventory_image_size / w;

        return new Vector4(
            (inventory_icon_id % icons_per_row) * w,
            Math.floor(inventory_icon_id / icons_per_row) * h,
            w,
            h
        );
    }

    //
    static registerStyle(style) {
        let reg_info = style.getRegInfo();
        for(let style of reg_info.styles) {
            BLOCK.styles.set(style, reg_info);
        }
    }

    //
    static getCardinalDirection(vec3) {
        if (!vec3) {
            return 0;
        }
        if (vec3.x && !(vec3.y * vec3.z)) {
            if(vec3.x >= 0 && vec3.x < 48 && vec3.x == Math.round(vec3.x)) {
                return vec3.x;
            }
        }
        if(vec3) {
            if(vec3.z >= 45 && vec3.z < 135) {
                return ROTATE.E;
            } else if(vec3.z >= 135 && vec3.z < 225) {
                return ROTATE.S;
            } else if(vec3.z >= 225 && vec3.z < 315) {
                return ROTATE.W;
            } else {
                return ROTATE.N;
            }
        }
        return CubeSym.ID; //was E
    }

    static isOnCeil(block) {
        return block.extra_data && block.extra_data?.point?.y >= .5; // на верхней части блока (перевернутая ступенька, слэб)
    }

    static isOpened(block) {
        return !!(block.extra_data && block.extra_data.opened);
    }

    static canFenceConnect(block) {
        return block.id > 0 &&
            (
                !block.material.transparent ||
                block.material.is_simple_qube ||
                block.material.is_solid ||
                block.material.style == 'fence' ||
                block.material.style == 'fence_gate' ||
                block.material.style == 'wall' ||
                block.material.style == 'pane'
            ) && (
                block.material.material.id != 'leaves'
            );
    }

    static canWallConnect(block) {
        return block.id > 0 &&
            (
                !block.material.transparent ||
                block.material.is_simple_qube ||
                block.material.is_solid ||
                block.material.style == 'wall' ||
                block.material.style == 'pane' ||
                block.material.style == 'fence'
            ) && (
                block.material.material.id != 'leaves'
            );
    }

    static canPaneConnect(block) {
        return this.canWallConnect(block);
    };

    static canRedstoneDustConnect(block) {
        return block.id > 0 && (block.material && 'redstone' in block.material);
    }

    static autoNeighbs(chunkManager, pos, cardinal_direction, neighbours) {
        const mat = CubeSym.matrices[cardinal_direction];
        if (!neighbours) {
            return {
                NORTH: chunkManager.getBlock(pos.x + mat[2], pos.y + mat[5], pos.z + mat[8]),
                SOUTH: chunkManager.getBlock(pos.x - mat[2], pos.y - mat[5], pos.z - mat[8]),
                EAST: chunkManager.getBlock(pos.x + mat[0], pos.y + mat[3], pos.z + mat[6]),
                WEST: chunkManager.getBlock(pos.x - mat[0], pos.y - mat[3], pos.z - mat[6])
            }
        }
        return {
            WEST: neighbours[NEIGHB_BY_SYM[CubeSym.dirAdd(cardinal_direction, DIRECTION.LEFT)]],
            EAST: neighbours[NEIGHB_BY_SYM[CubeSym.dirAdd(cardinal_direction, DIRECTION.RIGHT)]],
            NORTH: neighbours[NEIGHB_BY_SYM[CubeSym.dirAdd(cardinal_direction, DIRECTION.FORWARD)]],
            SOUTH: neighbours[NEIGHB_BY_SYM[CubeSym.dirAdd(cardinal_direction, DIRECTION.BACK)]],
        }
    }

    // getShapes
    static getShapes(pos, b, world, for_physic, expanded, neighbours) {
        let shapes = []; // x1 y1 z1 x2 y2 z2
        const material = b.material;
        if(!material) {
            return shapes;
        }
        let f = !!expanded ? .001 : 0;
        if(!material.passable && !material.planting) {
            switch(material.style) {
                case 'ladder': {
                    let cardinal_direction = b.getCardinalDirection();
                    let width = 3/15.9;
                    shapes.push(aabb.set(0, 0, 0, 1, 1, width).rotate(cardinal_direction, shapePivot).toArray());
                    break;
                }
                case 'fence': {
                    let height = for_physic ? 1.5 : 1;
                    //
                    let n = this.autoNeighbs(world.chunkManager, pos, 0, neighbours);
                    // world.chunkManager.getBlock(pos.x, pos.y, pos.z);
                    // South z--
                    if(this.canFenceConnect(n.SOUTH)) {
                        shapes.push([.5-2/16, 5/16, 0, .5+2/16, height, .5+2/16]);
                    }
                    // North z++
                    if(this.canFenceConnect(n.NORTH)) {
                        shapes.push([.5-2/16, 5/16, .5-2/16, .5+2/16, height, 1]);
                    }
                    // West x--
                    if(this.canFenceConnect(n.WEST)) {
                        shapes.push([0, 5/16, .5-2/16, .5+2/16, height, .5+2/16]);
                    }
                    // East x++
                    if(this.canFenceConnect(n.EAST)) {
                        shapes.push([.5-2/16, 5/16, .5-2/16, 1, height, .5+2/16]);
                    }
                    // Central
                    shapes.push([
                        .5-2/16, 0, .5-2/16,
                        .5+2/16, height, .5+2/16
                    ]);
                    break;
                }
                case 'wall': {
                    const CENTER_WIDTH      = 8 / 16;
                    const CONNECT_HEIGHT    = 14 / 16;
                    const CONNECT_BOTTOM    = 0 / 16;
                    const CONNECT_X         = 6 / 16;
                    const CONNECT_Z         = 8 / 16;
                    const height            = for_physic ? 1.5 : CONNECT_HEIGHT;
                    //
                    let zconnects = 0;
                    let xconnects = 0;
                    //
                    let n = this.autoNeighbs(world.chunkManager, pos, 0, neighbours);
                    // world.chunkManager.getBlock(pos.x, pos.y, pos.z);
                    // South z--
                    if(this.canWallConnect(n.SOUTH)) {
                        shapes.push([.5-CONNECT_X/2, CONNECT_BOTTOM, 0, .5-CONNECT_X/2 + CONNECT_X, height, CONNECT_Z/2]);
                        zconnects++;
                    }
                    // North z++
                    if(this.canWallConnect(n.NORTH)) {
                        if(zconnects) {
                            shapes.pop();
                            shapes.push([.5-CONNECT_X/2, CONNECT_BOTTOM, 0, .5-CONNECT_X/2 + CONNECT_X, height, 1]);
                        } else {
                            shapes.push([.5-CONNECT_X/2, CONNECT_BOTTOM, .5+CONNECT_Z/2, .5-CONNECT_X/2 + CONNECT_X, height, .5+CONNECT_Z]);
                        }
                        zconnects++;
                    }
                    // West x--
                    if(this.canWallConnect(n.WEST)) {
                        shapes.push([0, CONNECT_BOTTOM, .5-CONNECT_X/2, CONNECT_Z/2, height, .5-CONNECT_X/2 + CONNECT_X]);
                        xconnects++;
                    }
                    // East x++
                    if(this.canWallConnect(n.EAST)) {
                        if(xconnects) {
                            shapes.pop();
                            shapes.push([0, CONNECT_BOTTOM, .5-CONNECT_X/2, 1, height, .5-CONNECT_X/2 + CONNECT_X]);
                        } else {
                            shapes.push([1 - CONNECT_Z/2, CONNECT_BOTTOM, .5-CONNECT_X/2, 1, height, .5-CONNECT_X/2 + CONNECT_X]);
                        }
                        xconnects++;
                    }
                    if((zconnects == 2 && xconnects == 0) || (zconnects == 0 && xconnects == 2)) {
                        // do nothing
                    } else {
                        // Central
                        shapes.push([
                            .5-CENTER_WIDTH/2, 0, .5-CENTER_WIDTH/2,
                            .5+CENTER_WIDTH/2, Math.max(height, 1), .5+CENTER_WIDTH/2
                        ]);
                    }
                    break;
                }
                case 'thin': {
                    // F R B L
                    if(!(material.is_portal && for_physic)) {
                        let cardinal_direction = b.getCardinalDirection();
                        if(cardinal_direction == CubeSym.ROT_X) {
                            cardinal_direction = ROTATE.E;
                        } if(cardinal_direction == CubeSym.ROT_Z) {
                            cardinal_direction = ROTATE.N;
                        }
                        shapes.push(aabb.set(0, 0, .5-1/16, 1, 1, .5+1/16).rotate(cardinal_direction, shapePivot).toArray());
                    }
                    break;
                }
                case 'pane': {
                    let height = 1;
                    let w = 2/16;
                    let w2 = w/2;
                    //
                    let n = this.autoNeighbs(world.chunkManager, pos, 0, neighbours);
                    // world.chunkManager.getBlock(pos.x, pos.y, pos.z);
                    let con_s = this.canPaneConnect(n.SOUTH);
                    let con_n = this.canPaneConnect(n.NORTH);
                    let con_w = this.canPaneConnect(n.WEST);
                    let con_e = this.canPaneConnect(n.EAST);
                    let remove_center = con_s || con_n || con_w || con_e;
                    //
                    if(con_s && con_n) {
                        // remove_center = true;
                        shapes.push([.5-w2, 0, 0, .5+w2, height, .5+.5]);
                    } else {
                        // South z--
                        if(con_s) {
                            shapes.push([.5-w2, 0, 0, .5+w2, height, .5+w2]);
                        }
                        // North z++
                        if(con_n) {
                            shapes.push([.5-w2,0, .5-w2, .5+w2, height, 1]);
                        }
                    }
                    if(con_w && con_e) {
                        // remove_center = true;
                        shapes.push([0, 0, .5-w2, 1, height, .5+w2]);
                    } else {
                        // West x--
                        if(con_w) {
                            shapes.push([0, 0, .5-w2, .5+w2, height, .5+w2]);
                        }
                        // East x++
                        if(con_e) {
                            shapes.push([.5-w2, 0, .5-w2, 1, height, .5+w2]);
                        }
                    }
                    // Central
                    if(!remove_center) {
                        shapes.push([.5-w2, 0, .5-w2, .5+w2, height, .5+w2]);
                    }
                    break;
                }
                case 'slope':
                case 'stairs': {
                    shapes.push(...StyleStairs.calculate(b, pos, neighbours, world.chunkManager).getShapes(new Vector(pos).multiplyScalar(-1), f));
                    break;
                }
                case 'trapdoor': {
                    let cardinal_direction = b.getCardinalDirection();
                    let opened = this.isOpened(b);
                    let on_ceil = this.isOnCeil(b);
                    let sz = 3 / 16; // 15.9;
                    if(opened) {
                        shapes.push(aabb.set(0, 0, 0, 1, 1, sz).rotate(cardinal_direction, shapePivot).toArray());
                    } else {
                        if(on_ceil) {
                            shapes.push(aabb.set(0, 1-sz, 0, 1, 1, 1, sz).rotate(cardinal_direction, shapePivot).toArray());
                        } else {
                            shapes.push(aabb.set(0, 0, 0, 1, sz, 1, sz).rotate(cardinal_direction, shapePivot).toArray());
                        }
                    }
                    break;
                }
                case 'door': {
                    let cardinal_direction = CubeSym.dirAdd(b.getCardinalDirection(), CubeSym.ROT_Y2);
                    if(this.isOpened(b)) {
                        cardinal_direction = CubeSym.dirAdd(cardinal_direction, b.extra_data.left ? DIRECTION.RIGHT : DIRECTION.LEFT);
                    }
                    let sz = 3 / 15.9;
                    shapes.push(aabb.set(0, 0, 0, 1, 1, sz).rotate(cardinal_direction, shapePivot).toArray());
                    break;
                }
                default: {
                    const styleVariant = BLOCK.styles.get(material.style);
                    if (styleVariant && styleVariant.aabb) {
                        shapes.push(
                            ...styleVariant.aabb(b, for_physic).map(aabb => aabb.toArray())
                        );
                    } else {
                        debugger
                        console.error('Deprecated');
                    }
                    break;
                }
            }
        } else {
            if(!for_physic) {
                const styleVariant = BLOCK.styles.get(material.style);
                if (styleVariant && styleVariant.aabb) {
                    let aabbs = styleVariant.aabb(b);
                    if(!Array.isArray(aabbs)) {
                        aabbs = [aabbs];
                    }
                    shapes.push(
                        ...aabbs.map(aabb => aabb.toArray())
                    );
                } else {
                    switch(material.style) {
                        /*case 'sign': {
                            let hw = (4/16) / 2;
                            let sign_height = 1;
                            shapes.push([
                                .5-hw, 0, .5-hw,
                                .5+hw, sign_height, .5+hw
                            ]);
                            break;
                        }*/
                        case 'planting': {
                            let hw = (12/16) / 2;
                            let h = 12/16;
                            shapes.push([.5-hw, 0, .5-hw, .5+hw, h, .5+hw]);
                            break;
                        }
                    }
                }
            }
        }
        return shapes;
    }

    //
    static async sortBlocks() {
        //
        const sortByMaterial = (b, index) => {
            if(b.tags.includes('ore')) {
                index -= .01;
            } else if(b.window) {
                index -= .02;
            } else if(b.material.id == 'stone') {
                index -= .03;
            } else if(b.material.id == 'wood') {
                index -= .04;
            } else if(b.material.id == 'iron') {
                index -= .05;
            } else if(b.material.id == 'glass') {
                index -= .06;
            } else if(b.material.id == 'leaves') {
                index -= .07;
            } else if(b.material.id == 'dirt') {
                index -= .08;
            }
            return index;
        };
        //
        const all_blocks = [];
        for(let b of BLOCK.list.values()) {
            b.sort_index = 1000;
            if(b.item && !b.item?.instrument_id) {
                b.sort_index = sortByMaterial(b, 101);
            } else if(b.material.id == 'leather') {
                b.sort_index = 100;
            } else if(b.material.id == 'food') {
                b.sort_index = 99;
            } else if(b.material.id == 'bone') {
                b.sort_index = 98;
            } else if(b.material.id == 'plant') {
                b.sort_index = 97;
            } else if(b.style == 'planting') {
                b.sort_index = 96;
            } else if(b.item?.instrument_id) {
                b.sort_index = 95;
            } else if(b.style == 'stairs') {
                b.sort_index = sortByMaterial(b, 94);
            } else if(b.style == 'fence') {
                b.sort_index = sortByMaterial(b, 93);
            } else if(b.style == 'door') {
                b.sort_index = sortByMaterial(b, 92);
            } else if(b.style == 'trapdoor') {
                b.sort_index = sortByMaterial(b, 91);
            } else if(b.style == 'bed') {
                b.sort_index = 90;
            } else if(b.style == 'sign') {
                b.sort_index = 89;
            } else if(b.style == 'wall') {
                b.sort_index = sortByMaterial(b, 88);
            } else if(b.style == 'carpet') {
                b.sort_index = 87;
            } else if(b.layering) {
                b.sort_index = sortByMaterial(b, 86);
            } else if(b.material.id == 'glass') {
                b.sort_index = 85;
            } else if((b.width || b.height || b.depth) && !b.window && b.material.id != 'dirt') {
                b.sort_index = 84;
            } else if(b.style == 'default' || b.style == 'cube') {
                b.sort_index = sortByMaterial(b, 83);
            } else {
                b.sort_index = sortByMaterial(b, 101);
            }
            all_blocks.push(b);
        }
        //
        all_blocks.sort((a, b) => {
            return a.sort_index - b.sort_index;
        });
        //
        BLOCK.list_arr = [];
        for(let b of all_blocks) {
            BLOCK.list_arr.push(b);
        }
    }

    // Print free spaces id block id's
    static findPlace() {
        const ranges = [];
        let start = null;
        for(let id = 0; id < BLOCK.max_id; id++) {
            const b = BLOCK.BLOCK_BY_ID[id];
            if(b) {
                if(start !== null) {
                    ranges.push({start: start, end: id - 1, len: id - start});
                }
                start = null;
            } else {
                if(start === null) {
                    start = id;
                }
            }
        }
        ranges.sort((a, b) => {return a.len - b.len;});
        console.table(ranges);
    }

};

// Init
BLOCK.init = async function(settings) {

    if(BLOCK.list.size > 0) {
        throw 'error_blocks_already_inited';
    }

    BLOCK.reset();

    // Resource packs
    BLOCK.resource_pack_manager = new ResourcePackManager(BLOCK);

    // block styles and resorce styles is independent (should)
    // block styles is how blocks is generated
    // resource styles is textures for it

    return Promise.all([
        Resources.loadBlockStyles(settings),
        BLOCK.resource_pack_manager.init(settings)
    ]).then(async ([block_styles, _]) => {
        //
        await BLOCK.sortBlocks();
        // Block styles
        for(let style of block_styles.values()) {
            BLOCK.registerStyle(style);
        }
    });
};
