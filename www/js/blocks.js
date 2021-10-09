import { DIRECTION, ROTATE, TX_CNT, Vector, Vector4, VectorCollector } from './helpers.js';

export const CHUNK_SIZE_X                   = 16;
export const CHUNK_SIZE_Y                   = 32;
export const CHUNK_SIZE_Z                   = 16;
export const CHUNK_BLOCKS                   = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
export const CHUNK_SIZE_Y_MAX               = 4096;
export const MAX_CAVES_LEVEL                = 256;
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

    static styles = [];
    static ao_invisible_blocks = [];

    // applyLight2AO
    static applyLight2AO(lightmap, ao, x, y, z) {
        let index = BLOCK.getIndex(x, y, z);
        if(index >= 0 && index < CHUNK_BLOCKS) {
            let light_power = lightmap[index];
            if(light_power != 0) {
                light_power /= 4;
                ao = [
                    ao[0] - light_power,
                    ao[1] - light_power,
                    ao[2] - light_power,
                    ao[3] - light_power,
                ];
            }
        }
        return ao;
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

    // Возвращает адрес чанка по глобальным абсолютным координатам
    static getChunkAddr(x, y, z) {
        if(x instanceof Vector) {
            y = x.y;
            z = x.z;
            x = x.x;
        }
        //
        let v = new Vector(
            Math.floor(x / CHUNK_SIZE_X),
            Math.floor(y / CHUNK_SIZE_Y),
            Math.floor(z / CHUNK_SIZE_Z)
        );
        // Fix negative zero
        if(v.x == 0) {v.x = 0;}
        if(v.y == 0) {v.y = 0;}
        if(v.z == 0) {v.z = 0;}
        return v;
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

    static add(block) {
        this[block.name] = block;
    }

    // getCardinalDirection...
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

    // Call before setBlock
    static makeExtraData(block, pos) {
        block = BLOCK.BLOCK_BY_ID[block.id];
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
        if(this.BLOCK_BY_ID.hasOwnProperty(id)) {
            return this.BLOCK_BY_ID[id]
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

    // getAll
    static getAll() {
        if(this.list) {
            return this.list;
        }
        let list = this.list = [];
        this.BLOCK_BY_ID = {};
        this.BLOCK_BY_TAGS = {};
        // Function calc and return destroy time for specific block
        let calcDestroyTime = (block)  => {
            let destroy_time = .4;
            if(block.id == BLOCK.BEDROCK.id) {
                return -1;
            }
            if(block.hasOwnProperty('style')) {
                if(block.style == 'planting') {
                    return 0;
                }
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
        let max_id = -1;
        this.ao_invisible_blocks = [];
        for(let mat in this) {
            let B = this[mat];
            if(typeof(B) == 'object' && B.hasOwnProperty('id')) {
                // Check duplicate ID
                if(this.BLOCK_BY_ID.hasOwnProperty(B.id))  {
                    console.error('Duplicate block id ', B.id, B);
                }
                //
                B.name = mat;
                B.destroy_time = calcDestroyTime(B);
                B.power = 1;
                B.group = this.getBlockStyleGroup(B);
                B.selflit = B.hasOwnProperty('selflit') && B.selflit;
                B.transparent = B.hasOwnProperty('transparent') && B.transparent;
                B.style = B.hasOwnProperty('style') ? B.style : 'default';
                // Fix properties
                if(!B.hasOwnProperty('light')) B.light = null;
                if(!B.hasOwnProperty('spawnable')) B.spawnable = true;
                if(!B.hasOwnProperty('max_in_stack')) B.max_in_stack = INVENTORY_STACK_DEFAULT_SIZE;
                if(!B.hasOwnProperty('inventory_icon_id')) B.inventory_icon_id = 0;
                if(B.style && B.style == 'planting') B.planting = true;
                if(B.style && B.style == 'stairs') B.transparent = true;
                if(B.style && B.style == 'triangle') continue;
                if(B.planting || B.style == 'fence') this.ao_invisible_blocks.push(B.id);
                //
                if(B.id > max_id) {
                    max_id = B.id;
                }
                //
                this.BLOCK_BY_ID[B.id] = B;
                if(B.hasOwnProperty('tags')) {
                    for(let tag of B.tags) {
                        if(!this.BLOCK_BY_TAGS.hasOwnProperty(tag)) {
                            this.BLOCK_BY_TAGS[tag] = [];
                        }
                        this.BLOCK_BY_TAGS[tag].push(B);
                    }
                }
                //
                list.push(B);
            }
        }
        console.log('Max BLOCK.id = ', max_id);
        return list;
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

    // Возвращает координаты текстуры
    static calcTexture(c, dir) {
        if(c instanceof Function) {
            c = c(dir);
        } else if (c instanceof Array) {
            // do nothing
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
            (c[0] + 0.5) / TX_CNT,
            (c[1] + 0.5) / TX_CNT,
            1 / TX_CNT,
            1 / TX_CNT,
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
        let block_id = block;
        if(typeof block !== 'number') {
            block_id = block.id;
        }
        if(block_id < 1) return false;
        if(this.ao_invisible_blocks.indexOf(block_id) >= 0) return false;
        return true;
    }

    // pushVertices
    static pushVertices(vertices, block, world, lightmap, x, y, z, neighbours, biome) {
        // const style = 'style' in block ? block.style : 'default';
        const style = block.properties.style;
        let module = this.styles[style];
        if(!module) {
            throw 'Invalid vertices style `' + style + '`';
        }
        return module.func(block, vertices, world, lightmap, x, y, z, neighbours, biome, true);
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

    static isOnCeil(block) {
        return block.extra_data && block.extra_data.point.y >= .5; // на верхней части блока (перевернутая ступенька)
    }

    static isOpenedTrapdoor(block) {
        return !!(block.extra_data && block.extra_data.opened);
    }

    // getShapes
    static getShapes(pos, b, world, for_physic) {
        let shapes = []; // x1 y1 z1 x2 y2 z2
        let f = .001;
        if(!b.passable && (b.style != 'planting' && b.style != 'sign')) {
            switch(b.style) {
                case 'fence': {
                    let fence_height = for_physic ? 1.35 : 1;
                    //
                    let canConnect = (block) => {
                        return block && (!block.transparent || block.style == 'fence');
                    };
                    let neighbours = {
                        SOUTH: world.chunkManager.getBlock(pos.x, pos.y, pos.z - 1),
                        NORTH: world.chunkManager.getBlock(pos.x, pos.y, pos.z + 1),
                        WEST: world.chunkManager.getBlock(pos.x - 1, pos.y, pos.z),
                        EAST: world.chunkManager.getBlock(pos.x + 1, pos.y, pos.z)
                    }
                    world.chunkManager.getBlock(pos.x, pos.y, pos.z);
                    // South z--
                    if(canConnect(neighbours.SOUTH)) {
                        shapes.push([
                            .5-2/16, 5/16, 0,
                            .5+2/16, fence_height, .5+2/16]);
                    }
                    // North z++
                    if(canConnect(neighbours.NORTH)) {
                        shapes.push([.5-2/16, 5/16, .5-2/16, .5+2/16, fence_height, 1]);
                    }
                    // West x--
                    if(canConnect(neighbours.WEST)) {
                        shapes.push([0, 5/16, .5-2/16, .5+2/16, fence_height, .5+2/16]);
                    }
                    // East x++
                    if(canConnect(neighbours.EAST)) {
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
                    b.cardinal_direction = this.getCardinalDirection(b.rotate).z;
                    // F R B L
                    switch(b.cardinal_direction) {
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
                    b.cardinal_direction = this.getCardinalDirection(b.rotate).z;
                    b.on_ceil = this.isOnCeil(b);
                    let sz = 0.5;
                    if(b.on_ceil) {
                        shapes.push([0, sz - f, 0, 1, 1, 1]);
                        // F R B L
                        switch(b.cardinal_direction) {
                            case ROTATE.S: {
                                shapes.push([0, 0, sz - f, 1, sz, 1]);
                                break;
                            }
                            case ROTATE.N: {
                                shapes.push([0, 0, 0, 1, sz, sz + f]);
                                break;
                            }
                            case ROTATE.W: {
                                shapes.push([sz - f, 0, 0, 1, sz, 1]);
                                break;
                            }
                            case ROTATE.E: {
                                shapes.push([0, 0, 0, sz + f, sz, 1]);
                                break;
                            }
                        }
                    } else {
                        shapes.push([0, 0, 0, 1, sz + f, 1]);
                        // F R B L
                        switch(b.cardinal_direction) {
                            case ROTATE.S: {
                                shapes.push([0, sz, sz - f, 1, 1, 1]);
                                break;
                            }
                            case ROTATE.N: {
                                shapes.push([0, sz, 0, 1, 1, sz + f]);
                                break;
                            }
                            case ROTATE.W: {
                                shapes.push([sz - f, sz, 0, 1, 1, 1]);
                                break;
                            }
                            case ROTATE.E: {
                                shapes.push([0, sz, 0, sz + f, 1, 1]);
                                break;
                            }
                        }
                    }
                    break;
                }
                case 'trapdoor': {
                    b.cardinal_direction = this.getCardinalDirection(b.rotate).z;
                    b.opened = this.isOpenedTrapdoor(b);
                    b.on_ceil = this.isOnCeil(b);
                    let sz = 3 / 15.9;
                    if(b.opened) {
                        // F R B L
                        switch(b.cardinal_direction) {
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
                        if(b.on_ceil) {
                            shapes.push([0, 1-sz, 0, 1, 1, 1]);
                        } else {
                            shapes.push([0, 0, 0, 1, sz, 1]);
                        }
                    }
                    break;
                }
                case 'slab': {
                    b.on_ceil = this.isOnCeil(b);
                    if(b.on_ceil) {
                        shapes.push([0, .5, 0, 1, 1, 1]);
                    } else {
                        shapes.push([0, 0, 0, 1, .5, 1]);
                    }
                    break;
                }
                default: {
                    if(b.width) {
                        let hw = b.width / 2;
                        shapes.push([.5-hw, 0, .5-hw, .5+hw, b.height ? b.height: 1, .5+hw]);
                    } else {
                        shapes.push([0, 0, 0, 1, b.height ? b.height + .001: 1, 1]);
                    }
                    break;
                }
            }
        } else {
            if(!for_physic) {
                switch(b.style) {
                    case 'torch': {
                        let torch_height = 10/16;
                        shapes.push([
                            .5-1/16, 0, .5-1/16,
                            .5+1/16, torch_height, .5+1/16
                        ]);
                        break;
                    }
                    case 'sign': {
                        shapes.push([0, 0, 0, 1, b.height ? b.height : 1, 1]);
                        break;
                    }
                    case 'planting': {
                        let hw = (12/16) / 2;
                        let h = 12/16;
                        shapes.push([.5-hw, 0, .5-hw, .5+hw, h, .5+hw]);
                        break;
                    }
                    case 'ladder': {
                        b.cardinal_direction = this.getCardinalDirection(b.rotate).z;
                        let width = 1/16;
                        // F R B L
                        switch(b.cardinal_direction) {
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

//
await fetch('../data/blocks.json').then(response => response.json()).then(json => {
    json.sort((a, b) => {
        //
        if(a.inventory_icon_id == 0) {
            return 1;
        } else if(b.inventory_icon_id == 0) {
            return -1;
        }
        //
        if(!a.style) a.style = 'default';
        if(!b.style) b.style = 'default';
        if(a.style != b.style) {
            return a.style > b.style ? 1 : -1;
        }
        return b.id - a.id;
    });
    for(let block of json) {
        BLOCK.add(block);
    }
});

// Run getAll()
BLOCK.getAll();

// Load supported block styles
await fetch('../data/block_style.json').then(response => response.json()).then(json => {
    for(let code of json) {
        // load module
        import("./block_style/" + code + ".js").then(module => {
            BLOCK.registerStyle(module.default);
        });
    }
});