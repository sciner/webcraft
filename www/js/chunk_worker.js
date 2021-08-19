let queue               = [];

// Modules
let Vector              = null;
let BLOCK               = null;
let CHUNK_SIZE_X        = null;
let CHUNK_SIZE_Y        = null;
let CHUNK_SIZE_Z        = null;
let CHUNK_SIZE_Y_MAX    = null;
let MAX_CAVES_LEVEL     = null;

// Vars
let all_blocks          = []; // 1. All blocks
let blocks              = [];
let plant_blocks        = []; // 2. Plants
let chunks              = {};
let terrainGenerator    = null;

// ChunkManager
class ChunkManager {

    // Возвращает относительные координаты чанка по глобальным абсолютным координатам
    getChunkPos(x, y, z) {
        let v = new Vector(
            parseInt(x / CHUNK_SIZE_X),
            parseInt(y / CHUNK_SIZE_Y),
            parseInt(z / CHUNK_SIZE_Z)
        );
        if(x < 0) {v.x--;}
        if(z < 0) {v.z--;}
        if(v.x == 0) {v.x = 0;}
        if(v.y == 0) {v.y = 0;}
        if(v.z == 0) {v.z = 0;}
        return v;
    }

    getPosChunkKey(pos) {
        return 'c_' + pos.x + '_' + pos.y + '_' + pos.z;
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
        let chunkPos = this.getChunkPos(x, y, z);
        // обращаемся к чанку
        let chunk = this.getChunk(chunkPos);
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
        Object.assign(this, args);
        this.addr = new Vector(this.addr.x, this.addr.y, this.addr.z);
    }

    init() {
        // Variables
        this.vertices_length    = 0;
        this.vertices           = {};
        this.dirty              = true;
        this.fluid_blocks       = [];
        this.gravity_blocks     = [];
        this.lights             = [];
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
        this.timers.generate_terrain = Math.round((performance.now() - this.timers.generate_terrain) * 1000) / 1000;
        // 3. Apply modify_list
        this.timers.apply_modify = performance.now();
        this.applyModifyList();
        this.timers.apply_modify = Math.round((performance.now() - this.timers.apply_modify) * 1000) / 1000;
        // 4. Result
        postMessage(['blocks_generated', {
            key:    this.key,
            blocks: this.blocks,
            map:    this.map
        }]);
    }
    
    //
    applyModifyList() {
        for(let key of Object.keys(this.modify_list)) {
            let m           = this.modify_list[key];
            let pos         = key.split(',');
            let type        = BLOCK.fromId(m.id);
            let rotate      = m.rotate ? m.rotate : null;
            let entity_id   = m.entity_id ? m.entity_id : null;
            this.setBlock(parseInt(pos[0]), parseInt(pos[1]), parseInt(pos[2]), type, false, m.power, rotate, entity_id);
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
    setBlock(x, y, z, orig_type, is_modify, power, rotate, entity_id) {
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
        x -= this.coord.x;
        y -= this.coord.y;
        z -= this.coord.z;
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
    }
    
    // makeLights
    makeLights() {
        this.lights = [];
        // Lights
        for(let y = 0; y < this.size.y; y++) {
            for(let x = 0; x < this.size.x; x++) {
                for(let z = 0; z < this.size.z; z++) {
                    let block = this.blocks[x][z][y];
                    if(block && block.lightPower) {
                        this.lights.push({
                            power: block.lightPower,
                            x: x,
                            y: y,
                            z: z
                        });
                    }
                }
            }
        }
    }
    
    // buildVertices
    buildVertices() {
    
        if(!this.dirty || !this.blocks || !this.coord) {
            return false;
        }
    
        // Create map of lowest blocks that are still lit
        let lightmap            = {};
        let tm                  = performance.now();
        this.fluid_blocks       = [];
        this.gravity_blocks     = [];
    
        this.makeLights();
    
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
            doubleface: {
                list: [],
                is_transparent: true
            },
        }
    
        let neighbour_chunks = {
            nx: world.chunkManager.getChunk(new Vector(this.addr.x - 1, this.addr.y, this.addr.z)),
            px: world.chunkManager.getChunk(new Vector(this.addr.x + 1, this.addr.y, this.addr.z)),
            ny: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y - 1, this.addr.z)),
            py: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y + 1, this.addr.z)),
            nz: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y, this.addr.z - 1)),
            pz: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y, this.addr.z + 1))
        };

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
                    if(block.id == BLOCK.AIR.id) {
                        continue;
                    }
                    let group = 'regular';
                    // make vertices array
                    if([200, 202].indexOf(block.id) >= 0) {
                        // если это блок воды
                        group = 'transparent';
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
                            } /*else if (p.y == -1) {
                                b = this.blocks[x][z][y - 1];
                            } else if (p.y == 1) {
                                b = this.blocks[x][z][y + 1];
                            }*/
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
                    if(block.gravity && z > 0) {
                        let block_under = this.blocks[x][z][y - 1];
                        if(!block_under || [blocks.AIR.id, blocks.GRASS.id].indexOf(block_under.id) >= 0) {
                            this.gravity_blocks.push(new Vector(x + this.coord.x, y + this.coord.y, z + this.coord.z));
                        }
                    }
                    // if block is fluid
                    if(block.fluid) {
                        this.fluid_blocks.push(new Vector(x + this.coord.x, y + this.coord.y, z + this.coord.z));
                    }
                    if(!block.hasOwnProperty('vertices')) {
                        block = this.blocks[x][z][y] = Object.create(block);
                        block.vertices = [];
                        const biome = this.map.info.cells[x][z].biome;
                        BLOCK.pushVertices(block.vertices, block, world, lightmap, x + this.coord.x, y + this.coord.y, z + this.coord.z, neighbours, biome);
                    }
                    world.blocks_pushed++;
                    if(block.vertices.length > 0) {
                        this.vertices[group].list.push(...block.vertices);
                    }
                }
            }
        }

        // ~0ms
        for(let key of Object.keys(this.vertices)) {
            let v = this.vertices[key];
            for(let i = 0; i < v.list.length; i += GeometryTerrain.strideFloats) {
                v.list[i + 0] -= this.shift.x;
                v.list[i + 1] -= this.shift.z;
            }
            v.list = new Float32Array(v.list);
        }
        this.dirty = false;
        this.tm = performance.now() - tm;
        this.lightmap = lightmap;
        return true;
    }
    
    // setDirtyBlocks
    setDirtyBlocks(pos) {
        for(let cx = -1; cx <= 1; cx++) {
            for(let cz = -1; cz <= 1; cz++) {
                for(let cy = -1; cy <= 1; cy++) {
                    let x = pos.x + cx;
                    let y = pos.y + cy;
                    let z = pos.z + cz;
                    if(x >= 0 && y >= 0 && z >= 0 && x < this.size.x && y < this.size.y && z < this.size.z) {
                        let block = this.blocks[x][z][y];
                        if(block && typeof block === 'object') {
                            if(block.hasOwnProperty('vertices')) {
                                /*
                                if(!('id' in block)) {
                                    console.log(JSON.stringify(block));
                                    debugger;
                                }*/
                                delete(block['vertices']);
                            }
                        }
                    }
                }
            }
        }
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
async function importModules(terrain_type) {
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
    await import("./terrain_generator/" + terrain_type + ".js").then(module => {
        terrainGenerator = new module.default();
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
    // 2. Plants
    for(let b of BLOCK.getPlants()) {
        b = {...b};
        delete(b.texture);
        plant_blocks.push(b);
    }
    // Run queue items
    for(let item of queue) {
        await onmessage(item);
    }
    queue = [];
}

importModules('biome2');

// On message callback function
onmessage = async function(e) {
    if (!BLOCK || !terrainGenerator) {
        return queue.push(e);
    }
    const cmd = e.data[0];
    const args = e.data[1];
    switch(cmd) {
        case 'createChunk': {
            if(!terrainGenerator.seed) {
                terrainGenerator.setSeed(args.seed);
            }
            if(!chunks.hasOwnProperty(args.key)) {
                chunks[args.key] = new Chunk(args);
                chunks[args.key].init();
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
            if(chunks.hasOwnProperty(args.key)) {
                let chunk = chunks[args.key];
                chunk.dirty = true;
                chunk.shift = args.shift;
                chunk.timers.build_vertices = performance.now();
                chunk.buildVertices();
                chunk.timers.build_vertices = Math.round((performance.now() - chunk.timers.build_vertices) * 1000) / 1000;
                // result
                postMessage(['vertices_generated', {
                    key:                    chunk.key,
                    vertices:               chunk.vertices,
                    gravity_blocks:         chunk.gravity_blocks,
                    fluid_blocks:           chunk.fluid_blocks,
                    shift:                  chunk.shift,
                    timers:                 chunk.timers,
                    map:                    chunk.map.info,
                    tm:                     chunk.tm,
                    lightmap:               chunk.lightmap
                }]);
            }
            break;
        }
        case 'buildVerticesMany': {
            let result = [];
            for(let key of args.keys) {
                if(chunks.hasOwnProperty(key)) {
                    let chunk = chunks[key];
                    chunk.dirty = true;
                    chunk.shift = args.shift;
                    chunk.timers.build_vertices = performance.now();
                    chunk.buildVertices();
                    chunk.timers.build_vertices = Math.round((performance.now() - chunk.timers.build_vertices) * 1000) / 1000;
                    result.push({
                        key:                    chunk.key,
                        vertices:               chunk.vertices,
                        gravity_blocks:         chunk.gravity_blocks,
                        fluid_blocks:           chunk.fluid_blocks,
                        shift:                  chunk.shift,
                        timers:                 chunk.timers,
                        map:                    chunk.map.info,
                        tm:                     chunk.tm,
                        lightmap:               chunk.lightmap
                    });
                }
            }
            postMessage(['vertices_generated_many', result]);
            break;
        }
        case 'setBlock': {
            if(chunks.hasOwnProperty(args.key)) {
                // 1. Get chunk
                let chunk = chunks[args.key];
                // 2. Set new block
                if(args.type) {
                    chunk.setBlock(args.x, args.y, args.z, args.type, args.is_modify, args.power, args.rotate);
                }
                let pos = new Vector(args.x - chunk.coord.x, args.y - chunk.coord.y, args.z - chunk.coord.z);
                // 3. Clear vertices for new block and around near
                chunk.setDirtyBlocks(pos);
                // 4. Rebuild vertices list
                chunk.timers.build_vertices = performance.now();
                chunk.dirty = true;
                chunk.buildVertices();
                chunk.timers.build_vertices = Math.round((performance.now() - chunk.timers.build_vertices) * 1000) / 1000;
                // 5. Send result to chunk manager
                postMessage(['vertices_generated', {
                    key:                    chunk.key,
                    vertices:               chunk.vertices,
                    gravity_blocks:         chunk.gravity_blocks,
                    fluid_blocks:           chunk.fluid_blocks,
                    shift:                  chunk.shift,
                    timers:                 chunk.timers,
                    tm:                     chunk.tm,
                    lightmap:               chunk.lightmap
                }]);
            }
            break;
        }
    }
}