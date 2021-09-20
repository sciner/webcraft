let queue               = [];

// Modules
let Vector              = null;
let BLOCK               = null;
let CHUNK_SIZE_X        = null;
let CHUNK_SIZE_Y        = null;
let CHUNK_SIZE_Z        = null;
let CHUNK_SIZE_Y_MAX    = null;
let MAX_CAVES_LEVEL     = null;

let MAX_TORCH_POWER     = 16;

// Vars
let all_blocks          = []; // 1. All blocks
let chunks              = {};
let terrainGenerator    = null;

// ChunkManager
class ChunkManager {

    // Возвращает координаты чанка по глобальным абсолютным координатам
    getChunkAddr(x, y, z) {
        return BLOCK.getChunkAddr(x, y, z);
    }

    /**
     *
     * @param {Vector} pos
     * @returns
     */
    getPosChunkKey(pos) {
        return pos.toChunkKey();
    }

    // Get
    getChunk(pos) {
        let k = this.getPosChunkKey(pos);
        if(chunks.hasOwnProperty(k)) {
            return chunks[k];
        }
        return null;
    }

    // Возвращает блок по абслютным координатам
    getBlock(x, y, z) {
        // определяем относительные координаты чанка
        let chunkAddr = this.getChunkAddr(x, y, z);
        // обращаемся к чанку
        let chunk = this.getChunk(chunkAddr);
        // если чанк найден
        if(chunk) {
            // просим вернуть блок передав абсолютные координаты
            return chunk.getBlock(x, y, z);
        }
        return BLOCK.DUMMY;
    }

}

// Chunk
class Chunk {

    constructor(args) {
        this.instanced_blocks = {
            CONCRETE: blocks.CONCRETE
        };
        Object.assign(this, args);
        this.addr = new Vector(this.addr.x, this.addr.y, this.addr.z);
    }

    init(chunkManager) {
        this.chunkManager = chunkManager;
        // Variables
        this.vertices_length    = 0;
        this.vertices           = {};
        this.dirty              = true;
        this.fluid_blocks       = [];
        this.gravity_blocks     = [];
        this.lights             = [];
        this.lightmap           = null;
        this.timers             = {
            init:               null,
            generate_terrain:   null,
            apply_modify:       null,
            build_vertices:     null
        };
        // 1. Initialise world array
        this.timers.init = performance.now();
        this.blocks = new Array(this.size.x);
        for(let x = 0; x < this.size.x; x++) {
            this.blocks[x] = new Array(this.size.z);
            for(let z = 0; z < this.size.z; z++) {
                this.blocks[x][z] = [];
            }
        }
        this.timers.init = Math.round((performance.now() - this.timers.init) * 1000) / 1000;
        // 2. Generate terrain
        this.timers.generate_terrain = performance.now();
        this.map = terrainGenerator.generate(this);
        let c = {
            key:    this.key,
            blocks: this.blocks,
            map:    this.map
        };
        // console.log(JSON.stringify(c).length);
        this.timers.generate_terrain = Math.round((performance.now() - this.timers.generate_terrain) * 1000) / 1000;
        // 3. Apply modify_list
        this.timers.apply_modify = performance.now();
        this.applyModifyList();
        this.timers.apply_modify = Math.round((performance.now() - this.timers.apply_modify) * 1000) / 1000;
        //  4. Find lights
        this.findLights();
        // 5. Result
        postMessage(['blocks_generated', c]);
    }

    // findLights...
    findLights() {
        this.lights = [];
        for(let y = 0; y < this.size.y; y++) {
            for(let x = 0; x < this.size.x; x++) {
                for(let z = 0; z < this.size.z; z++) {
                    let block = this.blocks[x][z][y];
                    if(block && block.light_power) {
                        this.lights.push({
                            power: block.light_power,
                            pos: new Vector(x, y, z)
                        });
                    }
                }
            }
        }
    }

    //
    applyModifyList() {
        if(!this.modify_list) {
            return;
        }
        for(let key of Object.keys(this.modify_list)) {
            let m           = this.modify_list[key];
            let pos         = key.split(',');
            /*let mcp = BLOCK.getChunkAddr(new Vector(pos[0] | 0, pos[1] | 0, pos[2] | 0)).toChunkKey();
            if(this.addr.toChunkKey() != mcp) {
                console.log(this.addr.toChunkKey());
            }*/
            let type        = BLOCK.fromId(m.id);
            let rotate      = m.rotate ? m.rotate : null;
            let entity_id   = m.entity_id ? m.entity_id : null;
            let extra_data  = m.extra_data ? m.extra_data : null;
            this.setBlock(pos[0] | 0, pos[1] | 0, pos[2] | 0, type, false, m.power, rotate, entity_id, extra_data);
        }
    }

    // Get the type of the block at the specified position.
    // Mostly for neatness, since accessing the array
    // directly is easier and faster.
    getBlock(ox, oy, oz) {
        let x = ox - this.coord.x;
        let y = oy - this.coord.y;
        let z = oz - this.coord.z;
        if(x < 0 || y < 0 || x > this.size.x - 1 || y > this.size.y - 1 || z > this.size.z - 1) {
            return BLOCK.DUMMY;
        };
        if(z < 0 || z >= this.size.y) {
            return BLOCK.DUMMY;
        }
        let block = null;
        try {
            block = this.blocks[x][z][y];
        } catch(e) {
            console.error(e);
            console.log(x, y, z);
            debugger;
        }
        if(block == null) {
            return blocks.AIR;
        }
        return block || BLOCK.DUMMY;
    }

    // setBlock
    setBlock(x, y, z, orig_type, is_modify, power, rotate, entity_id, extra_data) {
        // fix rotate
        if(rotate && typeof rotate === 'object') {
            rotate = new Vector(
                Math.round(rotate.x * 10) / 10,
                Math.round(rotate.y * 10) / 10,
                Math.round(rotate.z * 10) / 10
            );
        } else {
            rotate = null;
        };
        // fix power
        if(typeof power === 'undefined' || power === null) {
            power = 1.0;
        }
        power = Math.round(power * 10000) / 10000;
        if(power <= 0) {
            return;
        }
        if(is_modify) {
            let modify_item = {
                id: orig_type.id,
                power: power,
                rotate: rotate
            };
            this.modify_list[[x, y, z]] = modify_item;
        }
        let pos = new Vector(x, y, z);
        pos = BLOCK.getBlockIndex(pos);
        x = pos.x;
        y = pos.y;
        z = pos.z;
        if(x < 0 || y < 0 || z < 0 || x > this.size.x - 1 || y > this.size.y - 1 || z > this.size.z - 1) {
            return;
        };
        if(is_modify) {
            console.table(orig_type);
        }
        this.blocks[x][z][y]            = {...BLOCK.fromId(orig_type.id)};
        this.blocks[x][z][y].power      = power;
        this.blocks[x][z][y].rotate     = rotate;
        this.blocks[x][z][y].entity_id  = entity_id;
        this.blocks[x][z][y].texture    = null;
        this.blocks[x][z][y].extra_data = extra_data;
    }

    // updateLights
    updateLights() {
        this.lightmap = new Uint8Array(this.size.x * this.size.y * this.size.z);
        // @todo доработать
        return;
        //
        let fillLight = (lx, ly, lz, power) => {
            if(power < 1) {
                return;
            }
            let f = (x, y, z, power) => {
                if(x >= 0 && y >= 0 && z >= 0 && x < 16 && z < 16 && y < 32) {
                    let b = this.blocks[x][z][y];
                    if(!b || b.id == 0 || b.transparent) {
                        let index = BLOCK.getIndex(x, y, z);
                        if(this.lightmap[index] < power) {    
                            this.lightmap[index] = power;
                            fillLight(x, y, z, power);
                        }
                    }
                }
            };
            f(lx + 1, ly, lz, power - 1);
            f(lx - 1, ly, lz, power - 1);
            f(lx, ly + 1, lz, power - 1);
            f(lx, ly - 1, lz, power - 1);
            f(lx, ly, lz + 1, power - 1);
            f(lx, ly, lz - 1, power - 1);
        };
        //
        // this.neighbour_chunks
        // Lightmap
        for(let light of this.lights) {
            let power = (light.power.a / 256 * MAX_TORCH_POWER) | 0;
            let index = BLOCK.getIndex(light.pos);
            this.lightmap[index] = power;
            fillLight(light.pos.x, light.pos.y, light.pos.z, power);
        }
        //
        let neighbors = [
            {pos: new Vector(CHUNK_SIZE_X, 0, 0), chunk: this.neighbour_chunks.px},
            {pos: new Vector(-CHUNK_SIZE_X, 0, 0), chunk: this.neighbour_chunks.nx},
            {pos: new Vector(0, CHUNK_SIZE_Y, 0), chunk: this.neighbour_chunks.py},
            {pos: new Vector(0, -CHUNK_SIZE_Y, 0), chunk: this.neighbour_chunks.ny},
            {pos: new Vector(0, 0, CHUNK_SIZE_Z), chunk: this.neighbour_chunks.pz},
            {pos: new Vector(0, 0, -CHUNK_SIZE_Z), chunk: this.neighbour_chunks.nz},
        ];
        for(let n of neighbors) {
            if(!n.chunk) continue;
            for(let light of n.chunk.lights) {
                let power = (light.power.a / 256 * MAX_TORCH_POWER) | 0;
                let pos = light.pos.add(n.pos);
                fillLight(pos.x, pos.y, pos.z, power);
            }
        }
    }

    // buildVertices
    buildVertices() {

        if(!this.dirty || !this.blocks || !this.coord) {
            return false;
        }

        // Create map of lowest blocks that are still lit
        // let lightmap            = {};
        let tm                  = performance.now();
        this.fluid_blocks       = [];
        this.gravity_blocks     = [];

        BLOCK.clearBlockCache();

        // Add vertices for blocks
        this.vertices = {
            regular: {
                list: [],
                is_transparent: false
            },
            transparent: {
                list: [],
                is_transparent: true
            },
            doubleface_transparent: {
                list: [],
                is_transparent: true
            },
            doubleface: {
                list: [],
                is_transparent: true
            },
        }

        let neighbour_chunks = this.neighbour_chunks = {
            nx: world.chunkManager.getChunk(new Vector(this.addr.x - 1, this.addr.y, this.addr.z)),
            px: world.chunkManager.getChunk(new Vector(this.addr.x + 1, this.addr.y, this.addr.z)),
            ny: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y - 1, this.addr.z)),
            py: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y + 1, this.addr.z)),
            nz: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y, this.addr.z - 1)),
            pz: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y, this.addr.z + 1))
        };

        //  Update lights
        this.updateLights();

        let cc = [
            {x:  0, y:  1, z:  0},
            {x:  0, y: -1, z:  0},
            {x:  0, y:  0, z: -1},
            {x:  0, y:  0, z:  1},
            {x: -1, y:  0, z:  0},
            {x:  1, y:  0, z:  0}
        ];
        for(let x = 0; x < this.size.x; x++) {
            for(let z = 0; z < this.size.z; z++) {
                let y_count = Math.min(this.size.y, this.blocks[x][z].length);
                for(let y = 0; y < y_count; y++) {
                    let block = this.blocks[x][z][y];
                    if(!block) {
                        continue;
                    }
                    if(typeof block === 'number') {
                        block = BLOCK.BLOCK_BY_ID[block];
                        if(!block) {
                            throw 'Not found id in blocks `' + this.blocks[x][z][y] + '`';
                        }
                    }
                    if(block.id == BLOCK.AIR.id) {
                        continue;
                    }
                    let group = 'regular';
                    // make vertices array
                    if([200, 202].indexOf(block.id) >= 0) {
                        // если это блок воды или облако
                        group = 'transparent';
                    } else if(block.tags && (block.tags.indexOf('glass') >= 0 || block.tags.indexOf('alpha') >= 0)) {
                        group = 'doubleface_transparent';
                    } else if(block.style == 'planting') {
                        group = 'doubleface';
                    }
                    // собираем соседей блока, чтобы на этой базе дальше отрисовывать или нет бока
                    let neighbours = {UP: null, DOWN: null, FORWARD: null, BACK: null, LEFT: null, RIGHT: null};
                    let pcnt = 0;
                    // обходим соседние блоки
                    for(let p of cc) {
                        let b = null;
                        if(x > 0 && y > 0 && z > 0 && x < this.size.x - 1 && y < this.size.y - 1 && z < this.size.z - 1) {
                            // если блок в том же чанке
                            b = this.blocks[x + p.x][z + p.z][y + p.y];
                        } else {
                            // если блок с краю чанка или вообще в соседнем чанке
                            if(p.x == -1) {
                                if(x == 0) {
                                    b = neighbour_chunks.nx.blocks[this.size.x - 1][z][y];
                                } else {
                                    b = this.blocks[x - 1][z][y];
                                }
                            } else if (p.x == 1) {
                                if(x == this.size.x - 1) {
                                    b = neighbour_chunks.px.blocks[0][z][y];
                                } else {
                                    b = this.blocks[x + 1][z][y];
                                }
                            // Y
                            } else if (p.y == -1) {
                                if(y == 0) {
                                    if(neighbour_chunks.ny) {
                                        b = neighbour_chunks.ny.blocks[x][z][this.size.y - 1];
                                    }
                                } else {
                                    b = this.blocks[x][z][y - 1];
                                }
                            } else if (p.y == 1) {
                                if(y == this.size.y - 1) {
                                    if(neighbour_chunks.py) {
                                        b = neighbour_chunks.py.blocks[x][z][0];
                                    }
                                } else {
                                    b = this.blocks[x][z][y + 1];
                                }
                            // Z
                            } else if (p.z == -1) {
                                if(z == 0) {
                                    b = neighbour_chunks.nz.blocks[x][this.size.z - 1][y];
                                } else {
                                    b = this.blocks[x][z - 1][y];
                                }
                            } else if (p.z == 1) {
                                if(z == this.size.z - 1) {
                                    b = neighbour_chunks.pz.blocks[x][0][y];
                                } else {
                                    b = this.blocks[x][z + 1][y];
                                }
                            }
                        }
                        if(typeof b == 'number') {
                            b = BLOCK.BLOCK_BY_ID[b];
                        }
                        if(p.y == 1) {
                            neighbours.UP = b;
                        } else if(p.y == -1) {
                            neighbours.DOWN = b;
                        } else if(p.z == -1) {
                            neighbours.FORWARD = b;
                        } else if(p.z == 1) {
                            neighbours.BACK = b;
                        } else if(p.x == -1) {
                            neighbours.LEFT = b;
                        } else if(p.x == 1) {
                            neighbours.RIGHT = b;
                        }
                        if(!b || (b.transparent || b.fluid)) {
                            // @нельзя прерывать, потому что нам нужно собрать всех "соседей"
                            // break;
                            pcnt = -40;
                        }
                        pcnt++;
                    }
                    // если у блока все соседи есть, значит его не видно и не нужно отрисовывать
                    if(pcnt == 6) {
                        continue;
                    }
                    /*
                    // lights
                    block.light = null;
                    for(let l of this.lights) {
                        let dist = Math.sqrt(
                            Math.pow(x - l.x, 2) +
                            Math.pow(y - l.y, 2) +
                            Math.pow(z - l.z, 2)
                        );
                        let maxDist = Math.round((l.power.a / 255) * 8);
                        if(dist <= maxDist) {
                            let newLight = new Color(l.power.r, l.power.g, l.power.b, l.power.a);
                            newLight.a *= ((maxDist - dist) / maxDist);
                            if(block.light) {
                                // @todo mix two light
                                if(block.light.a < newLight.a) {
                                    block.light = newLight;
                                }
                            } else {
                                block.light = newLight;
                            }
                            this.blocks[x][z][y] = {...block};
                        }
                    }
                    */
                    // if block with gravity
                    if(block.gravity && y > 1 && block.falling) {
                        let block_under = this.blocks[x][z][y - 1];
                        if(!block_under || [blocks.AIR.id, blocks.GRASS.id].indexOf(block_under.id) >= 0) {
                            this.gravity_blocks.push(new Vector(x, y, z));
                        }
                    }
                    // if block is fluid
                    if(block.fluid) {
                        this.fluid_blocks.push(new Vector(x, y, z));
                    }
                    if(!block.hasOwnProperty('vertices')) {
                        block = this.blocks[x][z][y] = Object.create(block);
                        block.vertices = [];
                        const biome = this.map.info.cells[x][z].biome;
                        neighbours.NORTH = neighbours.BACK && neighbours.BACK.id > 0 ? neighbours.BACK : null;
                        neighbours.SOUTH = neighbours.FORWARD && neighbours.FORWARD.id > 0 ? neighbours.FORWARD : null;
                        neighbours.WEST = neighbours.LEFT && neighbours.LEFT.id > 0 ? neighbours.LEFT : null;
                        neighbours.EAST = neighbours.RIGHT && neighbours.RIGHT.id > 0 ? neighbours.RIGHT : null;
                        delete(neighbours.LEFT);
                        delete(neighbours.RIGHT);
                        delete(neighbours.FORWARD);
                        delete(neighbours.BACK);
                        BLOCK.pushVertices(block.vertices, block, this, this.lightmap, x, y, z, neighbours, biome);
                    }
                    world.blocks_pushed++;
                    if(block.vertices.length > 0) {
                        this.vertices[group].list.push(...block.vertices);
                    }
                }
            }
        }

        this.dirty = false;
        this.tm = performance.now() - tm;
        // this.lightmap = null;
        return true;
    }

    // setDirtyBlocks
    // Вызывается, когда какой нибудь блок уничтожили (вокруг него все блоки делаем испорченными)
    setDirtyBlocks(pos) {
        let dirty_rad = MAX_TORCH_POWER;
        // let needUpdateLightmap = false;
        for(let cx = -dirty_rad; cx <= dirty_rad; cx++) {
            for(let cz = -dirty_rad; cz <= dirty_rad; cz++) {
                for(let cy = -dirty_rad; cy <= dirty_rad; cy++) {
                    let x = pos.x + cx;
                    let y = pos.y + cy;
                    let z = pos.z + cz;
                    if(x >= 0 && y >= 0 && z >= 0 && x < this.size.x && y < this.size.y && z < this.size.z) {
                        //
                        /*if(!needUpdateLightmap) {
                            let index = BLOCK.getIndex(x, y, z);
                            if(index >= 0) {
                                needUpdateLightmap = true;
                            }
                        }*/
                        //
                        let block = this.blocks[x][z][y];
                        if(block && typeof block === 'object') {
                            if(block.gravity) {
                                if(cy == 1 && cx == 0 && cz == 0) {
                                    block.falling = true;
                                }
                            }
                            if(block.hasOwnProperty('vertices')) {
                                delete(block['vertices']);
                            }
                        }
                    }
                }
            }
        }
        // if(needUpdateLightmap) {
        // @todo Переделать на вызов только в случае, если свет был поставлен или убран
        this.findLights();
        this.updateLights();
        // }
    }

}

// World
const world = {
    blocks_pushed: 0,
    chunkManager: new ChunkManager()
}

const GeometryTerrain = {
    strideFloats: 21,
}

/**
 * @param {string} terrain_type
 */
async function importModules(terrain_type, seed) {
    // load module
    await import("./helpers.js").then(module => {
        Vector = module.Vector;
    });
    // load module
    await import("./blocks.js").then(module => {
        BLOCK = module.BLOCK;
        CHUNK_SIZE_X        = module.CHUNK_SIZE_X;
        CHUNK_SIZE_Y        = module.CHUNK_SIZE_Y;
        CHUNK_SIZE_Z        = module.CHUNK_SIZE_Z;
        CHUNK_SIZE_Y_MAX    = module.CHUNK_SIZE_Y_MAX;
        MAX_CAVES_LEVEL     = module.MAX_CAVES_LEVEL;
    });
    // load module
    await import("./biomes.js").then(module => {
        blocks = module.blocks;
    });
    // load module
    await import("./terrain_generator/" + terrain_type + "/index.js").then(module => {
        terrainGenerator = new module.default(seed);
    });
    // Init vars
    // 1. Fill all_blocks
    for(let b of BLOCK.getAll()) {
        b = {...b};
        delete(b.texture);
        all_blocks.push(b);
    }
    for(let k in all_blocks) {
        all_blocks[k] = {...all_blocks[k]};
        delete(all_blocks[k].texture);
    }
    // Run queue items
    for(let item of queue) {
        await onmessage(item);
    }
    queue = [];
}

// On message callback function
onmessage = async function(e) {
    const cmd = e.data[0];
    const args = e.data[1];
    if(cmd == 'init') {
        // Init modules
        let generator_params = args;
        let seed = e.data[2];
        importModules(generator_params.id, seed); // biome2 | city | flat
        return;
    }
    if (!BLOCK || !terrainGenerator) {
        return queue.push(e);
    }
    switch(cmd) {
        case 'createChunk': {
            if(!chunks.hasOwnProperty(args.key)) {
                chunks[args.key] = new Chunk(args);
                chunks[args.key].init(world.chunkManager);
            }
            break;
        }
        case 'destructChunk': {
            if(chunks.hasOwnProperty(args.key)) {
                delete(chunks[args.key]);
            }
            break;
        }
        case 'buildVertices': {
            let result = [];
            for(let key of args.keys) {
                if(chunks.hasOwnProperty(key)) {
                    let chunk = chunks[key];
                    // 4. Rebuild vertices list
                    result.push(buildVertices(chunk, true));
                }
            }
            postMessage(['vertices_generated', result]);
            break;
        }
        case 'setBlock': {
            let result = [];
            // let pn = performance.now();
            for(let m of args) {
                if(chunks.hasOwnProperty(m.key)) {
                    // 1. Get chunk
                    let chunk = chunks[m.key];
                    // 2. Set new block
                    if(m.type) {
                        chunk.setBlock(m.x, m.y, m.z, m.type, m.is_modify, m.power, m.rotate, null, m.extra_data);
                    }
                    let pos = new Vector(m.x - chunk.coord.x, m.y - chunk.coord.y, m.z - chunk.coord.z);
                    // 3. Clear vertices for new block and around near
                    chunk.setDirtyBlocks(pos);
                    // 4. Rebuild vertices list
                    result.push(buildVertices(chunk, false));
                }
            }
            // console.log(result.length, performance.now() - pn, JSON.stringify(result).length, result);
            // 5. Send result to chunk manager
            postMessage(['vertices_generated', result]);
            break;
        }
    }
}

// Rebuild vertices list
function buildVertices(chunk, return_map) {
    chunk.dirty = true;
    chunk.timers.build_vertices = performance.now();
    chunk.buildVertices();
    chunk.timers.build_vertices = Math.round((performance.now() - chunk.timers.build_vertices) * 1000) / 1000;
    let resp = {
        key:                    chunk.key,
        vertices:               chunk.vertices,
        gravity_blocks:         chunk.gravity_blocks,
        fluid_blocks:           chunk.fluid_blocks,
        timers:                 chunk.timers,
        tm:                     chunk.tm,
        lightmap:               chunk.lightmap
    };
    if(return_map) {
        resp.map = chunk.map.info;
    }
    return resp;
}