let queue               = [];

// Modules
let Vector              = null;
let VectorCollector     = null;
let TypedBlocks         = null;
let BLOCK               = null;
let CHUNK_SIZE_X        = null;
let CHUNK_SIZE_Y        = null;
let CHUNK_SIZE_Z        = null;
let CHUNK_SIZE_Y_MAX    = null;
let MAX_CAVES_LEVEL     = null;

let MAX_TORCH_POWER     = 16;

// Vars
let all_blocks          = []; // 1. All blocks
let chunks              = null;
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
    getChunk(addr) {
        return chunks.get(addr);
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
        this.tblocks = new TypedBlocks();
        //
        this.timers.init = Math.round((performance.now() - this.timers.init) * 1000) / 1000;
        // 2. Generate terrain
        this.timers.generate_terrain = performance.now();
        this.map = terrainGenerator.generate(this);
        let c = {
            key:        this.key,
            addr:       this.addr,
            tblocks:    this.tblocks,
            map:        this.map
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
        /*for(let y = 0; y < this.size.y; y++) {
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
        }*/
    }

    //
    applyModifyList() {
        if(!this.modify_list) {
            return;
        }
        for(let key of Object.keys(this.modify_list)) {
            let m           = this.modify_list[key];
            let pos         = key.split(',');
            pos = new Vector(pos[0], pos[1], pos[2]);
            if(m.id < 1) {
                pos = BLOCK.getBlockIndex(pos);
                this.tblocks.delete(pos);
                continue;
            }
            let type        = BLOCK.fromId(m.id);
            let rotate      = m.rotate ? m.rotate : null;
            let entity_id   = m.entity_id ? m.entity_id : null;
            let extra_data  = m.extra_data ? m.extra_data : null;
            this.setBlock(pos.x | 0, pos.y | 0, pos.z | 0, type, false, m.power, rotate, entity_id, extra_data);
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
            // block = this.blocks[x][z][y];
            block = this.tblocks.get(new Vector(x, y, z));
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
        let block        = this.tblocks.get(new Vector(x, y, z));
        block.id         = orig_type.id;
        block.power      = power;
        block.rotate     = rotate;
        block.entity_id  = entity_id;
        block.texture    = null;
        block.extra_data = extra_data;
    }

    // updateLights
    updateLights() {
        if(!this.lightmap) {
            this.lightmap = new Uint8Array(this.size.x * this.size.y * this.size.z);
        }
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

    // Возвращает всех 6-х соседей блока
    getBlockNeighbors(pos) {
        let x = pos.x;
        let y = pos.y;
        let z = pos.z;
        let cc = [
            {x:  0, y:  1, z:  0},
            {x:  0, y: -1, z:  0},
            {x:  0, y:  0, z: -1},
            {x:  0, y:  0, z:  1},
            {x: -1, y:  0, z:  0},
            {x:  1, y:  0, z:  0}
        ];
        let neighbors = {UP: null, DOWN: null, SOUTH: null, NORTH: null, WEST: null, EAST: null};
        let pcnt = 0;
        // обходим соседние блоки
        for(let p of cc) {
            let b = null;
            if(x > 0 && y > 0 && z > 0 && x < this.size.x - 1 && y < this.size.y - 1 && z < this.size.z - 1) {
                // если сосед внутри того же чанка
                b = this.tblocks.get(new Vector(x + p.x, y + p.y, z + p.z));
            } else {
                // если блок с краю чанка или вообще в соседнем чанке
                if(p.x == -1) {
                    if(x == 0) {
                        b = this.neighbour_chunks.nx.tblocks.get(new Vector(this.size.x - 1, y, z));
                    } else {
                        b = this.tblocks.get(new Vector(x - 1, y, z));
                    }
                } else if (p.x == 1) {
                    if(x == this.size.x - 1) {
                        b = this.neighbour_chunks.px.tblocks.get(new Vector(0, y, z));
                    } else {
                        b = this.tblocks.get(new Vector(x + 1, y, z));
                    }
                // Y
                } else if (p.y == -1) {
                    if(y == 0) {
                        if(this.neighbour_chunks.ny) {
                            b = this.neighbour_chunks.ny.tblocks.get(new Vector(x, this.size.y - 1, z));
                        }
                    } else {
                        b = this.tblocks.get(new Vector(x, y - 1, z));
                    }
                } else if (p.y == 1) {
                    if(y == this.size.y - 1) {
                        if(this.neighbour_chunks.py) {
                            b = this.neighbour_chunks.py.tblocks.get(new Vector(x, 0, z));
                        }
                    } else {
                        b = this.tblocks.get(new Vector(x, y + 1, z));
                    }
                // Z
                } else if (p.z == -1) {
                    if(z == 0) {
                        b = this.neighbour_chunks.nz.tblocks.get(new Vector(x, y, this.size.z - 1));
                    } else {
                        b = this.tblocks.get(new Vector(x, y, z - 1));
                    }
                } else if (p.z == 1) {
                    if(z == this.size.z - 1) {
                        b = this.neighbour_chunks.pz.tblocks.get(new Vector(x, y, 0));
                    } else {
                        b = this.tblocks.get(new Vector(x, y, z + 1));
                    }
                }
            }
            if(p.y == 1) {
                neighbors.UP = b;
            } else if(p.y == -1) {
                neighbors.DOWN = b;
            } else if(p.z == -1) {
                neighbors.SOUTH = b;
            } else if(p.z == 1) {
                neighbors.NORTH = b;
            } else if(p.x == -1) {
                neighbors.WEST = b;
            } else if(p.x == 1) {
                neighbors.EAST = b;
            }
            let properties = b?.properties;
            if(!properties || b.properties.transparent || b.properties.fluid) {
                // @нельзя прерывать, потому что нам нужно собрать всех "соседей"
                // break;
                pcnt = -40;
            }
            pcnt++;
        }
        neighbors.pcnt = pcnt;
        return neighbors;
    }

    // buildVertices
    buildVertices() {

        if(!this.dirty || !this.tblocks || !this.coord) {
            return false;
        }

        // Create map of lowest blocks that are still lit
        // let lightmap            = {};
        let tm                  = performance.now();
        this.fluid_blocks       = [];
        this.gravity_blocks     = [];

        BLOCK.clearBlockCache();

        let group_templates = {
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
        };

        // Add vertices for blocks
        this.vertices = {};

        this.neighbour_chunks = {
            nx: world.chunkManager.getChunk(new Vector(this.addr.x - 1, this.addr.y, this.addr.z)),
            px: world.chunkManager.getChunk(new Vector(this.addr.x + 1, this.addr.y, this.addr.z)),
            ny: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y - 1, this.addr.z)),
            py: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y + 1, this.addr.z)),
            nz: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y, this.addr.z - 1)),
            pz: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y, this.addr.z + 1))
        };

        //  Update lights
        this.updateLights();

        // Обход всех блоков данного чанка
        for(let block of this.tblocks) {
            if(block.id == BLOCK.AIR.id) {
                continue;
            }
            // собираем соседей блока, чтобы на этой базе понять, дальше отрисовывать стороны или нет
            let neighbors = this.getBlockNeighbors(block.pos);
            // если у блока все соседи есть и они непрозрачные, значит блок невидно и ненужно отрисовывать
            if(neighbors.pcnt == 6) {
                continue;
            }
            // if block with gravity
            // @todo Проверить с чанка выше (тут пока грязный хак с y > 0)
            if(block.properties.gravity && block.pos.y > 0 && block.falling) {
                let block_under = this.tblocks.get(block.pos.sub(new Vector(0, 1, 0)));
                if([blocks.AIR.id, blocks.GRASS.id].indexOf(block_under.id) >= 0) {
                    this.gravity_blocks.push(block.pos);
                }
            }
            // if block is fluid
            if(block.properties.fluid) {
                this.fluid_blocks.push(block.pos);
            }
            if(block.vertices === null) {
                block.vertices = [];
                let biome = this.map.info.cells[block.pos.x][block.pos.z].biome;
                BLOCK.pushVertices(block.vertices, block, this, this.lightmap, block.pos.x, block.pos.y, block.pos.z, neighbors, biome);
            }
            world.blocks_pushed++;
            if(block.vertices !== null && block.vertices.length > 0) {
                if(!this.vertices[block.properties.group]) {
                    this.vertices[block.properties.group] = {...group_templates[block.properties.group]};
                }
                this.vertices[block.properties.group].list.push(...block.vertices);
            }
        }

        this.dirty = false;
        this.tm = performance.now() - tm;
        // this.lightmap = null;
        this.neighbour_chunks = null;
        return true;
    }

    // setDirtyBlocks
    // Вызывается, когда какой нибудь блок уничтожили (вокруг него все блоки делаем испорченными)
    setDirtyBlocks(pos) {
        let dirty_rad = MAX_TORCH_POWER;
        let cnt = 0;
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
                        let pos = new Vector(x, y, z);
                        if(this.tblocks.has(pos)) {
                            let block = this.tblocks.get(pos);
                            if(block.properties.gravity) {
                                if(cy == 1 && cx == 0 && cz == 0) {
                                    block.falling = true;
                                }
                            }
                            if(block.vertices) {
                                block.vertices = null;
                                cnt++;
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
        return cnt;
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
async function importModules(terrain_type, seed, world_id) {
    // load module
    await import("./helpers.js").then(module => {
        Vector = module.Vector;
        VectorCollector = module.VectorCollector;
        chunks = new VectorCollector();
    });
    // load module
    await import("./typed_blocks.js").then(module => {
        TypedBlocks = module.TypedBlocks;
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
        terrainGenerator = new module.default(seed, world_id);
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
        let world_id = e.data[3];
        importModules(generator_params.id, seed, world_id); // biome2 | city | flat
        return;
    }
    if (!BLOCK || !terrainGenerator) {
        return queue.push(e);
    }
    switch(cmd) {
        case 'createChunk': {
            if(!chunks.has(args.addr)) {
                let chunk = new Chunk(args);
                chunk.init(world.chunkManager);
                chunks.add(args.addr, chunk);
            }
            break;
        }
        case 'destructChunk': {
            if(chunks.has(args.addr)) {
                chunks.delete(args.addr);
                terrainGenerator.deleteMap(args.addr);
            }
            break;
        }
        case 'buildVertices': {
            let result = [];
            for(let addr of args.addrs) {
                let chunk = chunks.get(addr);
                if(chunk) {
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
                // 1. Get chunk
                let chunk = chunks.get(m.addr);
                if(chunk) {
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
        case 'stat': {
            try {
                console.table({
                    maps_cache_count: terrainGenerator.maps_cache.size,
                    maps_cache_size: JSON.stringify(terrainGenerator.maps_cache).length/1024/1024,
                    chunks_count: chunks.size,
                });
            } catch(e) {
                console.error(e);
            }
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
        addr:                   chunk.addr,
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