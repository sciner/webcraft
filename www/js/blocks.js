import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_BLOCKS } from "./chunk.js";
import { DIRECTION, ROTATE, TX_CNT, Vector, Vector4, VectorCollector, Helpers } from './helpers.js';
import { ResourcePackManager } from './resource_pack_manager.js';

export const TRANS_TEX                      = [4, 12];
export const INVENTORY_STACK_DEFAULT_SIZE   = 64;

// BLOCK PROPERTIES:
// fluid (bool)                 - Is fluid
// gravity (bool)               - May fall
// id (int)                     - Unique ID
// instrument_id (string)       - Unique code of instrument type
// inventory_icon_id (int)      - Position in inventory atlas
// is_item (bool)               - ?
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

export class BLOCK {

    static list                 = [];
    static styles               = [];
    static ao_invisible_blocks  = [];

    static resource_packs       = ['/resource_packs/default/init.js', '/resource_packs/lodestone/init.js'/*, '/resource_packs/quake2/init.js'*/];
    static resource_pack_manager = null;

    // applyLight2AO
    static applyLight2AO(lightmap, ao, x, y, z) {
        return ao;

        // let index = BLOCK.getIndex(x, y, z);
        // if(index >= 0 && index < CHUNK_BLOCKS) {
        //     let light_power = lightmap[index];
        //     if(light_power != 0) {
        //         light_power /= 4;
        //         ao = [
        //             ao[0] - light_power,
        //             ao[1] - light_power,
        //             ao[2] - light_power,
        //             ao[3] - light_power,
        //         ];
        //     }
        // }
        // return ao;
    }

    static getLightPower(material) {
        if(material.light_power) {
            return Math.floor(material.light_power.a / 16.0);
        } else if (!material.transparent) {
            return 255;
        } else {
            return 0;
        }
    }

    // Return flat index of chunk block
    static getIndex(x, y, z) {
        if(x instanceof Vector) {
            y = x.y;
            z = x.z;
            x = x.x;
        }
        let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
        /*
        if(index < 0) {
            index = -1;
        } else if(index > CHUNK_BLOCKS) {
            index = -1;
        }
        */
        return index;
    }

    //
    static getBlockIndex(x, y, z) {
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
        let v = new Vector(
            f(x, CHUNK_SIZE_X),
            f(y, CHUNK_SIZE_Y),
            f(z, CHUNK_SIZE_Z),
        );
        if(x < 0) v.x = CHUNK_SIZE_X - 1 - v.x;
        if(y < 0) v.y = CHUNK_SIZE_Y - 1 - v.y;
        if(z < 0) v.z = CHUNK_SIZE_Z - 1 - v.z;
        return v;
    }

    // Call before setBlock
    static makeExtraData(block, pos) {
        block = BLOCK.BLOCK_BY_ID.get(block.id);
        let extra_data = null;
        if(!block.tags) {
            return extra_data;
        }
        let is_trapdoor = block.tags.indexOf('trapdoor') >= 0;
        let is_stairs = block.tags.indexOf('stairs') >= 0;
        let is_slab = block.tags.indexOf('slab') >= 0;
        if(is_trapdoor || is_stairs || is_slab) {
            extra_data = {
                point: new Vector(pos.point.x, pos.point.y, pos.point.z)
            };
            if(is_trapdoor) {
                extra_data.opened = false;
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

    // cloneFromId
    static cloneFromId(id) {
        let b = {...BLOCK.fromId(id)};
        // delete(b['spawnable']);
        // delete(b['max_in_stack']);
        // delete(b['inventory_icon_id']);
        // delete(b['destroy_time']);
        // delete(b['passable']);
        return b;
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
    static canReplace(block_id) {
        if(block_id == 0) {
            return true;
        }
        if([BLOCK.GRASS.id, BLOCK.STILL_WATER.id, BLOCK.STILL_LAVA.id, BLOCK.FLOWING_LAVA.id, BLOCK.FLOWING_WATER.id, BLOCK.CLOUD.id].indexOf(block_id) >= 0) {
            return true;
        }
        let block = BLOCK.BLOCK_BY_ID.get(block_id);
        return !!block.fluid;
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
        if([200, 202].indexOf(block.id) >= 0) {
            // если это блок воды или облако
            group = 'transparent';
        } else if(block.tags && (block.tags.indexOf('glass') >= 0 || block.tags.indexOf('alpha') >= 0)) {
            group = 'doubleface_transparent';
        } else if(block.style == 'planting' || block.style == 'ladder' || block.style == 'sign') {
            group = 'doubleface';
        }
        return group;
    }

    static reset() {
        BLOCK.list                   = [];
        BLOCK.BLOCK_BY_ID            = new Map();
        BLOCK.BLOCK_BY_TAGS          = {};
        BLOCK.ao_invisible_blocks    = [];
    }

    static async add(block) {
        // Check duplicate ID
        if(this.BLOCK_BY_ID.has(block.id))  {
            console.error('Duplicate block id ', block.id, block);
        }
        // Function calc and return destroy time for specific block
        let calcDestroyTime = (block) => {
            let destroy_time = .4;
            // bedrock
            if(block.id == 1) {
                return -1;
            }
            if(block.hasOwnProperty('style')) {
                if(block.style == 'planting') {
                    return 0;
                }
            }
            if(block.id == 50) {
                return 0;
            }
            if(block.hasOwnProperty('sound')) {
                switch(block.sound) {
                    case 'madcraft:block.grass':
                        destroy_time = 1.;
                        break;
                    case 'madcraft:block.gravel':
                    case 'madcraft:block.sand': {
                        destroy_time = 2.;
                        break;
                    }
                    case 'madcraft:block.wood': {
                        destroy_time = 4.;
                        break;
                    }
                    case 'madcraft:block.stone': {
                        destroy_time = 7.;
                        break;
                    }
                }
            }
            return destroy_time;
        };
        //
        block.style = block.hasOwnProperty('style') ? block.style : 'default';
        if(block.style && block.style == 'triangle') {
            return;
        }
        block.destroy_time      = calcDestroyTime(block);
        block.power             = 1;
        block.group             = this.getBlockStyleGroup(block);
        block.selflit           = block.hasOwnProperty('selflit') && block.selflit;
        block.transparent       = block.hasOwnProperty('transparent') && block.transparent;
        // Fix properties
        if(!block.hasOwnProperty('light')) block.light = null;
        if(!block.hasOwnProperty('passable')) block.passable = 0;
        if(!block.hasOwnProperty('spawnable')) block.spawnable = true;
        if(!block.hasOwnProperty('max_in_stack')) block.max_in_stack = INVENTORY_STACK_DEFAULT_SIZE;
        if(!block.hasOwnProperty('inventory_icon_id')) block.inventory_icon_id = 0;
        if(block.style && block.style == 'planting') block.planting = true;
        if(block.style && block.style == 'stairs') block.transparent = true;
        if(block.planting || block.style == 'fence' || block.style == 'ladder' || block.light_power) {
            this.ao_invisible_blocks.push(block.id);
        }
        // Parse tags
        if(block.hasOwnProperty('tags')) {
            for(let tag of block.tags) {
                if(!this.BLOCK_BY_TAGS.hasOwnProperty(tag)) {
                    this.BLOCK_BY_TAGS[tag] = [];
                }
                this.BLOCK_BY_TAGS[tag].push(block);
            }
        } else {
            block.tags = [];
        }
        // Calculate in last time, after all init procedures
        block.visible_for_ao = BLOCK.visibleForAO(block);
        this[block.name] = block;
        BLOCK.BLOCK_BY_ID.set(block.id, block);
        this.list.push(block);
    }

    // getAll
    static getAll() {
        return this.list;
    }

    /**
     * Возвращает время, необходимое для того, чтобы разбить блок голыми руками
     * @param { Object } block
     * @param { Bool } force Фиксированное и ускоренное разбитие (например в режиме креатива)
     * @return float
     */
    static getDestroyTime(block, force, instrument) {
        let destroy_time = block.destroy_time;
        if(force) {
            destroy_time = 0;
        }
        return destroy_time;
    }

    // Возвращает координаты текстуры с учетом информации из ресурс-пака
    static calcMaterialTexture(material, dir) {
        let tx_cnt = TX_CNT;
        // Get tx_cnt from resource pack texture
        if (typeof material.texture === 'object' && 'id' in material.texture) {
            let tex = material.resource_pack.conf.textures[material.texture.id];
            if('tx_cnt' in tex) {
                tx_cnt = tex.tx_cnt;
            }
        }
        return this.calcTexture(material.texture, dir, tx_cnt);
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
                case DIRECTION.FORWARD: {prop = 'south'; break;}
                case DIRECTION.BACK: {prop = 'north'; break;}
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
            1 / tx_cnt,
        ];
    }

    /**
     * clearBlockCache...
     */
    static clearBlockCache() {
        BLOCK.block_cache = new VectorCollector();
        BLOCK.cachedBlocksUsed = 0;
        BLOCK.cachedBlocksMiss = 0;
    }

    /**
     * getCachedBlock...
     * @param { int } x
     * @param { int } y
     * @param { int } z
     * @returns
     */
    static getCachedBlock(chunk, x, y, z) {
        const x1 = x + chunk.coord.x;
        const y1 = y + chunk.coord.y;
        const z1 = z + chunk.coord.z;
        if (chunk.size && x >= 0 && x < chunk.size.x
            && y >= 0 && y < chunk.size.y
            && z >= 0 && z < chunk.size.z) {
            return chunk.getBlock(x1, y1, z1);
        }
        let vec = new Vector(x1, y1, z1);
        let block = BLOCK.block_cache.get(vec);
        if(block) {
            BLOCK.cachedBlocksUsed++;
            return block;
        }
        BLOCK.cachedBlocksMiss++;
        block = chunk.chunkManager.getBlock(x1, y1, z1);
        BLOCK.block_cache.add(vec, block);
        return block;
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
    static getInventoryIconPos(inventory_icon_id) {
        let w = 32;
        let h = 32;
        return new Vector4(
            (inventory_icon_id % w) * w,
            Math.floor(inventory_icon_id / h) * h,
            w,
            h
        );
    }

    //
    static registerStyle(style) {
        let reg_info = style.getRegInfo();
        for(let style of reg_info.styles) {
            BLOCK.styles[style] = reg_info;
        }
    }

    //
    static getCardinalDirection(vec3) {
        let result = new Vector(0, 0, ROTATE.E);
        if(vec3) {
            if(vec3.z >= 45 && vec3.z < 135) {
                // do nothing
            } else if(vec3.z >= 135 && vec3.z < 225) {
                result.z = ROTATE.S;
            } else if(vec3.z >= 225 && vec3.z < 315) {
                result.z = ROTATE.W;
            } else {
                result.z = ROTATE.N;
            }
        }
        return result;
    }

    static isOnCeil(block) {
        return block.extra_data && block.extra_data.point.y >= .5; // на верхней части блока (перевернутая ступенька)
    }

    static isOpenedTrapdoor(block) {
        return !!(block.extra_data && block.extra_data.opened);
    }

    static canFenceConnect(block) {
        return block.id > 0 && (!block.properties.transparent || block.properties.style == 'fence');
    }

    // getShapes
    static getShapes(pos, b, world, for_physic, expanded, neighbours) {
        let shapes = []; // x1 y1 z1 x2 y2 z2
        let f = !!expanded ? .001 : 0;
        if(!b.properties.passable && (b.properties.style != 'planting' && b.properties.style != 'sign')) {
            switch(b.properties.style) {
                case 'fence': {
                    let fence_height = for_physic ? 1.35 : 1;
                    //
                    if(!neighbours) {
                        neighbours = {
                            SOUTH: world.chunkManager.getBlock(pos.x, pos.y, pos.z - 1),
                            NORTH: world.chunkManager.getBlock(pos.x, pos.y, pos.z + 1),
                            WEST: world.chunkManager.getBlock(pos.x - 1, pos.y, pos.z),
                            EAST: world.chunkManager.getBlock(pos.x + 1, pos.y, pos.z)
                        }
                    }
                    world.chunkManager.getBlock(pos.x, pos.y, pos.z);
                    // South z--
                    if(this.canFenceConnect(neighbours.SOUTH)) {
                        shapes.push([
                            .5-2/16, 5/16, 0,
                            .5+2/16, fence_height, .5+2/16]);
                    }
                    // North z++
                    if(this.canFenceConnect(neighbours.NORTH)) {
                        shapes.push([.5-2/16, 5/16, .5-2/16, .5+2/16, fence_height, 1]);
                    }
                    // West x--
                    if(this.canFenceConnect(neighbours.WEST)) {
                        shapes.push([0, 5/16, .5-2/16, .5+2/16, fence_height, .5+2/16]);
                    }
                    // East x++
                    if(this.canFenceConnect(neighbours.EAST)) {
                        shapes.push([.5-2/16, 5/16, .5-2/16, 1, fence_height, .5+2/16]);
                    }
                    // Central
                    shapes.push([
                        .5-2/16, 0, .5-2/16,
                        .5+2/16, fence_height, .5+2/16
                    ]);
                    break;
                }
                case 'pane': {
                    // F R B L
                    switch(b.getCardinalDirection().z) {
                        case ROTATE.S:
                        case ROTATE.N: {
                            shapes.push([0, 0, .5-1/16, 1, 1, .5+1/16]);
                            break;
                        }
                        case ROTATE.W:
                        case ROTATE.E: {
                            shapes.push([.5-1/16, 0, 0, .5+1/16, 1, 1]);
                            break;
                        }
                    }
                    break;
                }
                case 'stairs': {
                    if(!neighbours) {
                        neighbours = {
                            SOUTH: world.chunkManager.getBlock(pos.x, pos.y, pos.z - 1),
                            NORTH: world.chunkManager.getBlock(pos.x, pos.y, pos.z + 1),
                            WEST: world.chunkManager.getBlock(pos.x - 1, pos.y, pos.z),
                            EAST: world.chunkManager.getBlock(pos.x + 1, pos.y, pos.z)
                        }
                    }
                    let cardinal_direction = b.getCardinalDirection().z;
                    //
                    let checkIfSame = (b) => {
                        return b.id > 0 && b.properties.tags && b.properties.tags.indexOf('stairs') >= 0;
                    };
                    //
                    let compareCD = (b) => {
                        return checkIfSame(b) && b.getCardinalDirection().z == cardinal_direction;
                    };
                    let on_ceil = this.isOnCeil(b);
                    let sz = 0.5;
                    let yt = 0;
                    // Основная часть
                    if(on_ceil) {
                        shapes.push([0, sz - f, 0, 1, 1, 1]);
                    } else {
                        shapes.push([0, 0, 0, 1, sz + f, 1]);
                        yt = .5;
                    }
                    // Верхняя ступенька (либо нижняя, если блок перевернуть вертикально)
                    let poses = [];
                    switch(cardinal_direction) {
                        case ROTATE.S: {
                            poses = [
                                new Vector(.5, yt, .5),
                                new Vector(0, yt, .5),
                            ];
                            // удаление лишних
                            if(!(checkIfSame(neighbours.WEST) && checkIfSame(neighbours.EAST)) && checkIfSame(neighbours.NORTH)) {
                                if(compareCD(neighbours.WEST)) {
                                    poses.shift();
                                } else if(compareCD(neighbours.EAST)) {
                                    poses.pop();
                                }
                            }
                            // добавление недостающих
                            if(checkIfSame(neighbours.SOUTH)) {
                                let cd = neighbours.SOUTH.getCardinalDirection().z;
                                if(cd == ROTATE.E) {
                                    poses.push(new Vector(0, yt, 0));
                                } else if(cd == ROTATE.W) {
                                    poses.push(new Vector(.5, yt, 0));
                                }
                            }
                            break;
                        }
                        case ROTATE.N: {
                            poses = [
                                new Vector(.5, yt, 0),
                                new Vector(0, yt, 0),
                            ];
                            // удаление лишних
                            if(!(checkIfSame(neighbours.WEST) && checkIfSame(neighbours.EAST)) && checkIfSame(neighbours.SOUTH)) {
                                if(compareCD(neighbours.WEST)) {
                                    poses.shift();
                                } else if(compareCD(neighbours.EAST)) {
                                    poses.pop();
                                }
                            }
                            // добавление недостающих
                            if(checkIfSame(neighbours.NORTH)) {
                                let cd = neighbours.NORTH.getCardinalDirection().z;
                                if(cd == ROTATE.W) {
                                    poses.push(new Vector(.5, yt, .5));
                                } else if(cd == ROTATE.E || cd == ROTATE.N) {
                                    poses.push(new Vector(0, yt, .5));
                                }
                            }
                            break;
                        }
                        case ROTATE.W: {
                            poses = [
                                new Vector(.5, yt, 0),
                                new Vector(.5, yt, .5),
                            ];
                            // удаление лишних
                            if(!(checkIfSame(neighbours.NORTH) && checkIfSame(neighbours.SOUTH)) && checkIfSame(neighbours.EAST)) {
                                if(compareCD(neighbours.NORTH)) {
                                    poses.shift();
                                } else if(compareCD(neighbours.SOUTH)) {
                                    poses.pop();
                                }
                            }
                            // добавление недостающих
                            if(checkIfSame(neighbours.WEST)) {
                                let cd = neighbours.WEST.getCardinalDirection().z;
                                if(cd == ROTATE.S) {
                                    poses.push(new Vector(0, yt, .5));
                                } else if(cd == ROTATE.N) {
                                    poses.push(new Vector(0, yt, 0));
                                }
                            }
                            break;
                        }
                        case ROTATE.E: {
                            poses = [
                                new Vector(0, yt, 0),
                                new Vector(0, yt, .5),
                            ];
                            // удаление лишних
                            if(!(checkIfSame(neighbours.NORTH) && checkIfSame(neighbours.SOUTH)) && checkIfSame(neighbours.WEST)) {
                                if(compareCD(neighbours.NORTH)) {
                                    poses.shift();
                                } else if(compareCD(neighbours.SOUTH)) {
                                    poses.pop();
                                }
                            }
                            // добавление недостающих
                            if(checkIfSame(neighbours.EAST)) {
                                let cd = neighbours.EAST.getCardinalDirection().z;
                                if(cd == ROTATE.N) {
                                    poses.push(new Vector(.5, yt, 0));
                                } else if(cd == ROTATE.S) {
                                    poses.push(new Vector(.5, yt, .5));
                                }
                            }
                            break;
                        }
                    }
                    for(let pose of poses) {
                        shapes.push([pose.x - f, pose.y, pose.z - f, pose.x + .5 + f, pose.y + .5, pose.z + .5 + f])
                    }
                    break;
                }
                case 'trapdoor': {
                    let cardinal_direction = b.getCardinalDirection().z;
                    let opened = this.isOpenedTrapdoor(b);
                    let on_ceil = this.isOnCeil(b);
                    let sz = 3 / 15.9;
                    if(opened) {
                        // F R B L
                        switch(cardinal_direction) {
                            // z--
                            case ROTATE.S: {
                                shapes.push([0, 0, 1-sz, 1, 1, 1]);
                                break;
                            }
                            // z++
                            case ROTATE.N: {
                                shapes.push([0, 0, 0, 1, 1, sz]);
                                break;
                            }
                            case ROTATE.W: {
                                shapes.push([1-sz, 0, 0, 1, 1, 1]);
                                break;
                            }
                            case ROTATE.E: {
                                shapes.push([0, 0, 0, sz, 1, 1]);
                                break;
                            }
                        }
                    } else {
                        if(on_ceil) {
                            shapes.push([0, 1-sz, 0, 1, 1, 1]);
                        } else {
                            shapes.push([0, 0, 0, 1, sz, 1]);
                        }
                    }
                    break;
                }
                case 'slab': {
                    let on_ceil = this.isOnCeil(b);
                    if(on_ceil) {
                        shapes.push([0, .5 - f, 0, 1, 1, 1]);
                    } else {
                        shapes.push([0, 0, 0, 1, .5 + f, 1]);
                    }
                    break;
                }
                default: {
                    if(b.properties.width) {
                        let hw = b.properties.width / 2;
                        shapes.push([.5-hw, 0, .5-hw, .5+hw, b.properties.height ? b.properties.height: 1, .5+hw]);
                    } else {
                        shapes.push([0, 0, 0, 1, b.properties.height ? b.properties.height + .001: 1, 1]);
                    }
                    break;
                }
            }
        } else {
            if(!for_physic) {
                switch(b.properties.style) {
                    case 'torch': {
                        let torch_height = 10/16;
                        shapes.push([
                            .5-1/16, 0, .5-1/16,
                            .5+1/16, torch_height, .5+1/16
                        ]);
                        break;
                    }
                    case 'sign': {
                        shapes.push([0, 0, 0, 1, b.properties.height ? b.properties.height : 1, 1]);
                        break;
                    }
                    case 'planting': {
                        let hw = (12/16) / 2;
                        let h = 12/16;
                        shapes.push([.5-hw, 0, .5-hw, .5+hw, h, .5+hw]);
                        break;
                    }
                    case 'ladder': {
                        let cardinal_direction = b.getCardinalDirection().z;
                        let width = 1/16;
                        // F R B L
                        switch(cardinal_direction) {
                            // z--
                            case ROTATE.S: {
                                shapes.push([0, 0, 1-width, 1, 1, 1]);
                                break;
                            }
                            // z++
                            case ROTATE.N: {
                                shapes.push([0, 0, 0, 1, 1, width]);
                                break;
                            }
                            case ROTATE.W: {
                                shapes.push([1-width, 0, 0, 1, 1, 1]);
                                break;
                            }
                            case ROTATE.E: {
                                shapes.push([0, 0, 0, width, 1, 1]);
                                break;
                            }
                        }
                        break;
                    }
                }
            }
        }
        return shapes;
    }

};

// Init
BLOCK.init = async function(cb) {

    // Init resource packs and other
    let all = [];
    let resource_packs = new Set();
    for(let init_file of BLOCK.resource_packs) {
        all.push(import('..' + init_file).then((module) => {resource_packs.add(module.default);}));
    }
    await Promise.all(all).then(() => { return this; });
    all = [BLOCK.load(resource_packs)]

    // After
    await Promise.all(all).then(cb);

}

// Load
BLOCK.load = async function(resource_packs) {

    // Load supported block styles
    let json_url = '../data/block_style.json';

    await Helpers.fetchJSON(json_url)
    .then((json) => {
        for(let code of json) {
            // Load module
            import('./block_style/' + code + '.js').then(module => {
                BLOCK.registerStyle(module.default);
            });
        }
    });

    //
    if(BLOCK.list.length == 0) {
        // Reset slots
        BLOCK.reset();
        // Load Resourse packs (blocks)
        BLOCK.resource_pack_manager = new ResourcePackManager();
        for(let rp of resource_packs.values()) {
            await BLOCK.resource_pack_manager.registerResourcePack(rp);
        }
    }

};
