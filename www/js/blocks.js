import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "./chunk.js";
import { DIRECTION, ROTATE, TX_CNT, Vector, Vector4 } from './helpers.js';
import { ResourcePackManager } from './resource_pack_manager.js';
import { Resources } from "./resources.js";
import { CubeSym } from "./core/CubeSym.js";
import { AABB } from './core/AABB.js';

export const TRANS_TEX                      = [4, 12];
export const INVENTORY_STACK_DEFAULT_SIZE   = 64;

// Свойства, которые могут сохраняться в БД
export const ITEM_DB_PROPS                  = ['count', 'entity_id', 'extra_data', 'power', 'rotate'];
const BLOCK_HAS_WINDOW                      = ['CRAFTING_TABLE', 'CHEST', 'FURNACE', 'BURNING_FURNACE'];

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

export class BLOCK {

    static list                     = new Map();
    static styles                   = new Map();
    static spawn_eggs               = [];
    static ao_invisible_blocks      = [];
    static resource_pack_manager    = null;
    static max_id                   = 0;
    static MASK_BIOME_BLOCKS        = [];

    static getLightPower(material) {
        if (!material) {
            return 0;
        }
        let val = 0;
        if(material.light_power) {
            val = Math.floor(material.light_power.a / 16.0);
        } else if (!material.transparent) {
            val = 127;
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
    static convertItemToInventoryItem(item) {
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

    //
    static getBlockIndex(x, y, z, v = null) {
        if(x instanceof Vector) {
            y = x.y;
            z = x.z;
            x = x.x;
        }
        let f = (v, m) => {
            if(v < 0) v++;
            v = v % m;
            if(v == 0) v = 0;
            if(v < 0) v *= -1;
            return v;
        };
        if(v) {
            v.x = f(x, CHUNK_SIZE_X);
            v.y = f(y, CHUNK_SIZE_Y);
            v.z = f(z, CHUNK_SIZE_Z);
        } else {
            v = new Vector(
                f(x, CHUNK_SIZE_X),
                f(y, CHUNK_SIZE_Y),
                f(z, CHUNK_SIZE_Z),
            );
        }
        if(x < 0) v.x = CHUNK_SIZE_X - 1 - v.x;
        if(y < 0) v.y = CHUNK_SIZE_Y - 1 - v.y;
        if(z < 0) v.z = CHUNK_SIZE_Z - 1 - v.z;
        return v;
    }

    // Call before setBlock
    static makeExtraData(block, pos, orientation) {
        block = BLOCK.BLOCK_BY_ID.get(block.id);
        let extra_data = null;
        if(!block.tags) {
            return extra_data;
        }
        let is_trapdoor = block.tags.indexOf('trapdoor') >= 0;
        let is_stairs = block.tags.indexOf('stairs') >= 0;
        let is_door = block.tags.indexOf('door') >= 0;
        let is_slab = block.layering && block.layering.slab;
        if(is_trapdoor || is_stairs || is_door || is_slab) {
            extra_data = {
                point: new Vector(pos.point.x, pos.point.y, pos.point.z)
            };
            // Trapdoor
            if(is_trapdoor) {
                extra_data.opened = false;
            }
            // Door
            if(is_door) {
                extra_data.opened = false;
                extra_data.left = false;
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
            if(pos.n.y == 1) {
                extra_data.point.y = 0;
            } else if(pos.n.y == -1) {
                extra_data.point.y = 1;
            }
        }
        return extra_data;
    }

    // Returns a block structure for the given id.
    static fromId(id) {
        if(this.BLOCK_BY_ID.has(id)) {
            return this.BLOCK_BY_ID.get(id);
        }
        console.error('Warning: id missing in BLOCK ' + id);
        return this.DUMMY;
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
        if([BLOCK.GRASS.id, BLOCK.STILL_WATER.id, BLOCK.FLOWING_WATER.id, BLOCK.STILL_LAVA.id, BLOCK.FLOWING_LAVA.id, BLOCK.CLOUD.id, BLOCK.TALL_GRASS.id, BLOCK.TALL_GRASS_TOP.id].indexOf(block_id) >= 0) {
            return true;
        }
        let block = BLOCK.BLOCK_BY_ID.get(block_id);
        if(block.fluid) {
            return true;
        }
        if(block.layering) {
            let height = extra_data ? (extra_data.height ? parseFloat(extra_data.height) : 1) : block.height;
            return !isNaN(height) && height == block.height && block_id != replace_with_block_id;
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
            Object.assign({count: 6}, this.BOOKCASE),
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
    static getBlockStyleGroup(block) {
        let group = 'regular';
        // make vertices array
        if([200, 202].indexOf(block.id) >= 0 || block.style == 'pane') {
            // если это блок воды или облако
            group = 'transparent';
        } else if(block.tags && (block.tags.indexOf('glass') >= 0 || block.tags.indexOf('alpha') >= 0)) {
            group = 'doubleface_transparent';
        } else if(block.style == 'planting' || block.style == 'ladder' || block.style == 'sign' || block.style == 'door') {
            group = 'doubleface';
        }
        return group;
    }

    static reset() {
        BLOCK.spawn_eggs             = [];
        BLOCK.ao_invisible_blocks    = [];
        BLOCK.list                   = new Map();
        BLOCK.BLOCK_BY_ID            = new Map();
        BLOCK.BLOCK_BY_TAGS          = new Map();
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

    static async add(resource_pack, block) {
        // Check duplicate ID
        if(!('name' in block) || !('id' in block)) {
            throw 'error_invalid_block';
        }
        const existing_block = this.BLOCK_BY_ID.has(block.id) ? this.fromId(block.id) : null;
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
        block.has_window        = BLOCK_HAS_WINDOW.indexOf(block.name) >= 0;
        block.style             = this.parseBlockStyle(block);
        block.tags              = block?.tags || [];
        block.power             = (('power' in block) && !isNaN(block.power) && block.power > 0) ? block.power : 1;
        block.group             = this.getBlockStyleGroup(block);
        block.selflit           = block.hasOwnProperty('selflit') && !!block.selflit;
        block.deprecated        = block.hasOwnProperty('deprecated') && !!block.deprecated;
        block.transparent       = this.parseBlockTransparent(block);
        block.is_water          = block.is_fluid && [200, 202].indexOf(block.id) >= 0;
        block.planting          = ('planting' in block) ? block.planting : (block.material.id == 'plant');
        block.resource_pack     = resource_pack;
        block.material_key      = BLOCK.makeBlockMaterialKey(resource_pack, block);
        block.can_rotate        = 'can_rotate' in block ? block.can_rotate : block.tags.filter(x => ['trapdoor', 'stairs', 'door'].indexOf(x) >= 0).length > 0;
        if(block.planting && !('inventory_style' in block)) {
            block.inventory_style = 'extruder';
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
        // Add to ao_invisible_blocks list
        if(block.planting || block.style == 'fence' || block.style == 'wall' || block.style == 'pane' || block.style == 'ladder' || block.light_power || block.tags.indexOf('no_drop_ao') >= 0) {
            if(this.ao_invisible_blocks.indexOf(block.id) < 0) {
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
            for(let prop_name of original_props) {
                existing_block[prop_name] = block[prop_name];
            }
            block = existing_block;
        } else {
            this[block.name] = block;
            BLOCK.BLOCK_BY_ID.set(block.id, block);
            this.list.set(block.id, block);
        }
        // After add works
        // Add spawn egg
        if(block.spawn_egg && BLOCK.spawn_eggs.indexOf(block.id) < 0) {
            BLOCK.spawn_eggs.push(block.id);
        }
        if(block.tags.indexOf('mask_biome') >= 0 && BLOCK.MASK_BIOME_BLOCKS.indexOf(block.id) < 0) {
            BLOCK.MASK_BIOME_BLOCKS.push(block.id)
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

    // Make material key
    static makeBlockMaterialKey(resource_pack, material) {
        let mat_group = material.group;
        let texture_id = 'default';
        if(typeof material.texture == 'object' && 'id' in material.texture) {
            texture_id = material.texture.id;
        }
        return `${resource_pack.id}/${mat_group}/${texture_id}`;
    }

    // getAll
    static getAll() {
        return this.list;
    }

    static isEgg(block_id) {
        return BLOCK.spawn_eggs.indexOf(block_id) >= 0;
    }

    // Возвращает координаты текстуры с учетом информации из ресурс-пака
    static calcMaterialTexture(material, dir, width, height) {
        let tx_cnt = TX_CNT;
        // Get tx_cnt from resource pack texture
        if (typeof material.texture === 'object' && 'id' in material.texture) {
            let tex = material.resource_pack.conf.textures[material.texture.id];
            if('tx_cnt' in tex) {
                tx_cnt = tex.tx_cnt;
            }
        }
        let c = this.calcTexture(material.texture, dir, tx_cnt);
        if(height && height < 1) {
            c[1] += 0.5 / tx_cnt - height / tx_cnt / 2;
            c[3] *= height;
        }
        return c;
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
        return [
            (c[0] + 0.5) / tx_cnt,
            (c[1] + 0.5) / tx_cnt,
            1 / tx_cnt,
            c[2] === 2 ? - 1 / tx_cnt : 1 / tx_cnt
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
        if(this.ao_invisible_blocks.indexOf(block_id) >= 0) return false;
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
        return block.extra_data && block.extra_data.point.y >= .5; // на верхней части блока (перевернутая ступенька, слэб)
    }

    static isOpened(block) {
        return !!(block.extra_data && block.extra_data.opened);
    }

    static canFenceConnect(block) {
        return block.id > 0 && (!block.properties.transparent || block.properties.style == 'fence');
    }

    static canWallConnect(block) {
        return block.id > 0 && (!block.properties.transparent || block.properties.style == 'wall' || block.properties.style == 'pane');
    }

    static canPaneConnect(block) {
        return this.canWallConnect(block);
    };

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
        const material = b.properties;
        if(!material) {
            return shapes;
        }
        let f = !!expanded ? .001 : 0;
        if(!material.passable && (material.style != 'planting' /*&& material.style != 'sign'*/)) {
            switch(material.style) {
                case 'fence': {
                    let height = for_physic ? 1.5 : 1;
                    //
                    let n = this.autoNeighbs(world.chunkManager, pos, 0, neighbours);
                    world.chunkManager.getBlock(pos.x, pos.y, pos.z);
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
                    const CONNECT_WIDTH     = 6 / 16;
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
                    world.chunkManager.getBlock(pos.x, pos.y, pos.z);
                    // South z--
                    if(this.canWallConnect(n.SOUTH)) {
                        shapes.push([.5-CONNECT_X/2, CONNECT_BOTTOM, 0, .5-CONNECT_X/2 + CONNECT_X, height, CONNECT_Z]);
                        zconnects++;
                    }
                    // North z++
                    if(this.canWallConnect(n.NORTH)) {
                        if(zconnects) {
                            shapes.pop();
                            shapes.push([.5-CONNECT_X/2, CONNECT_BOTTOM, 0, .5-CONNECT_X/2 + CONNECT_X, height, 1]);
                        } else {
                            shapes.push([.5-CONNECT_X/2, CONNECT_BOTTOM, .5, .5-CONNECT_X/2 + CONNECT_X, height, .5+CONNECT_Z]);
                        }
                        zconnects++;
                    }
                    // West x--
                    if(this.canWallConnect(n.WEST)) {
                        shapes.push([
                            0,
                            CONNECT_BOTTOM,
                            .5-CONNECT_X/2, 
                            CONNECT_Z,
                            height,
                            .5-CONNECT_X/2 + CONNECT_X
                        ]);
                        xconnects++;
                    }
                    // East x++
                    if(this.canWallConnect(n.EAST)) {
                        if(xconnects) {
                            shapes.pop();
                            shapes.push([
                                0,
                                CONNECT_BOTTOM,
                                .5-CONNECT_X/2,
                                1,
                                height,
                                .5-CONNECT_X/2 + CONNECT_X
                            ]);
                        } else {
                            shapes.push([
                                .5,
                                CONNECT_BOTTOM,
                                .5-CONNECT_X/2,
                                .5+CONNECT_Z,
                                height,
                                .5-CONNECT_X/2 + CONNECT_X
                            ]);
                        }
                        xconnects++;
                    }
                    if((zconnects == 2 && xconnects == 0) || (zconnects == 0 && xconnects == 2)) {
                        // do nothing
                    } else {
                        if(!for_physic) {
                            // Central
                            shapes.push([
                                .5-CENTER_WIDTH/2, 0, .5-CENTER_WIDTH/2,
                                .5+CENTER_WIDTH/2, Math.max(height, 1), .5+CENTER_WIDTH/2
                            ]);
                        }
                    }
                    break;
                }
                case 'thin': {
                    // F R B L
                    let cardinal_direction = b.getCardinalDirection();
                    shapes.push(aabb.set(0, 0, .5-1/16, 1, 1, .5+1/16).rotate(cardinal_direction, shapePivot).toArray());
                    break;
                }
                case 'pane': {
                    let height = 1;
                    let w = 2/16;
                    let w2 = w/2;
                    //
                    let n = this.autoNeighbs(world.chunkManager, pos, 0, neighbours);
                    world.chunkManager.getBlock(pos.x, pos.y, pos.z);
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
                case 'stairs': {
                    let cardinal_direction = b.getCardinalDirection();
                    let n = this.autoNeighbs(world.chunkManager, pos, cardinal_direction, neighbours);
                    //
                    let checkIfSame = (checked_block) => {
                        return checked_block.id > 0 && checked_block.material.tags && checked_block.material.tags.indexOf('stairs') >= 0;
                    };
                    //
                    let on_ceil = this.isOnCeil(b);
                    let sz = 0.5;
                    let yt = 0;
                    // Основная часть
                    if(on_ceil) {
                        shapes.push(aabb.set(0, sz - f, 0, 1, 1, 1)
                            .rotate(cardinal_direction, shapePivot).toArray());
                    } else {
                        shapes.push(aabb.set(0, 0, 0, 1, sz + f, 1)
                            .rotate(cardinal_direction, shapePivot).toArray());
                        yt = .5;
                    }
                    // Верхняя ступенька (либо нижняя, если блок перевернуть вертикально)
                    let poses = [];
                    poses = [
                        new Vector(.5, yt, 0),
                        new Vector(0, yt, 0),
                    ];
                    // удаление лишних
                    if(!(checkIfSame(n.WEST) && checkIfSame(n.EAST)) && checkIfSame(n.SOUTH)) {
                        let cd = CubeSym.sub(n.SOUTH.getCardinalDirection(), cardinal_direction);
                        if(cd == ROTATE.E) {
                            poses.shift();
                        } else if (cd == ROTATE.W) {
                            poses.pop();
                        }
                    }
                    // добавление недостающих
                    if(!(checkIfSame(n.WEST) && checkIfSame(n.EAST)) && checkIfSame(n.NORTH)) {
                        let cd = CubeSym.sub(n.NORTH.getCardinalDirection(), cardinal_direction);
                        if(!checkIfSame(n.EAST) && cd == ROTATE.W) {
                            poses.push(new Vector(.5, yt, .5));
                        }
                        if(!checkIfSame(n.WEST) && cd == ROTATE.E) {
                            poses.push(new Vector(0, yt, .5));
                        }
                    }
                    for(let pose of poses) {
                        shapes.push(
                            aabb.set(pose.x - f, pose.y, pose.z - f, pose.x + .5 + f, pose.y + .5 + f, pose.z + .5 + f)
                                .rotate(cardinal_direction, shapePivot).toArray());
                    }
                    break;
                }
                case 'trapdoor': {
                    let cardinal_direction = b.getCardinalDirection();
                    let opened = this.isOpened(b);
                    let on_ceil = this.isOnCeil(b);
                    let sz = 3 / 15.9;
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
                            styleVariant.aabb(b).toArray()
                        );
                    } else {
                        let shift_y = 0;
                        let height = material.height ? material.height : 1;
                        // Высота наслаеваемых блоков хранится в extra_data
                        if(material.layering) {
                            if(b.extra_data) {
                                height = b.extra_data?.height || height;
                            }
                            if(material.layering.slab) {
                                let on_ceil = this.isOnCeil(b);
                                if(on_ceil) {
                                    shift_y = material.layering.height;
                                }
                            }
                        }
                        if(material.width) {
                            let hw = material.width / 2;
                            shapes.push([.5-hw, shift_y - f, .5-hw, .5+hw, shift_y + height + f, .5+hw]);
                        } else {
                            shapes.push([0, shift_y - f, 0, 1, shift_y + height + f, 1]);
                        }
                    }
                    break;
                }
            }
        } else {
            if(!for_physic) {
                const styleVariant = BLOCK.styles.get(material.style);
                if (styleVariant && styleVariant.aabb) {
                    shapes.push(
                        styleVariant.aabb(b).toArray()
                    );
                } else {
                    switch(material.style) {
                        case 'sign': {
                            let hw = (4/16) / 2;
                            let sign_height = 1;
                            shapes.push([
                                .5-hw, 0, .5-hw,
                                .5+hw, sign_height, .5+hw
                            ]);
                            break;
                        }
                        case 'planting': {
                            let hw = (12/16) / 2;
                            let h = 12/16;
                            shapes.push([.5-hw, 0, .5-hw, .5+hw, h, .5+hw]);
                            break;
                        }
                        case 'ladder': {
                            let cardinal_direction = b.getCardinalDirection();
                            let width = 1/16;
                            shapes.push(aabb.set(0, 0, 0, 1, 1, width).rotate(cardinal_direction, shapePivot).toArray());
                            break;
                        }
                    }
                }                
            }
        }
        return shapes;
    }

};

// Init
BLOCK.init = async function(settings) {

    if(BLOCK.list.size > 0) {
        throw 'Already inited';
    }

    BLOCK.reset();

    // Block styles
    let block_styles = await Resources.loadBlockStyles();
    for(let style of block_styles.values()) {
        BLOCK.registerStyle(style);
    }

    // Resource packs
    BLOCK.resource_pack_manager = new ResourcePackManager();
    await BLOCK.resource_pack_manager.init(settings);

};