let queue               = [];

// Modules
let Vector              = null;
let BLOCK               = null;
let CHUNK_SIZE_X        = null;
let CHUNK_SIZE_Y        = null;
let CHUNK_SIZE_Z        = null;
let CHUNK_BLOCKS        = null;
let CHUNK_SIZE_Y_MAX    = null;
let MAX_CAVES_LEVEL     = null;
let VectorCollector     = null;

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

    // Процедура поиска всех источников света в чанке
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
            if(m.id < 1) {
                pos = new Vector(pos[0], pos[1], pos[2]);
                pos = BLOCK.getBlockIndex(pos);
                this.blocks[pos.x][pos.z][pos.y] = null;
                continue;
            }
            let type        = BLOCK.fromId(m.id);
            if(type.id == -1) {
                console.error(pos, m);
                return;
            }
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
        this.blocks[x][z][y]            = BLOCK.cloneFromId(orig_type.id);
        this.blocks[x][z][y].power      = power;
        this.blocks[x][z][y].rotate     = rotate;
        this.blocks[x][z][y].entity_id  = entity_id;
        this.blocks[x][z][y].texture    = null;
        this.blocks[x][z][y].extra_data = extra_data;
    }

    // Обновление карты свет для чанка
    updateLights() {
        this.lightmap_temp = new Uint8Array(this.size.x * this.size.y * this.size.z);
        //
        let vc = new VectorCollector();
        // Рекурсивный метод заливки светом пустых или прозрачных блоков
        let fillLight = (lx, ly, lz, power) => {
            if(power < 1) {
                return;
            }
            let f = (x, y, z, power) => {
                let chunk = this;
                let b = null;
                let in_chunk = x >= 0 && y >= 0 && z >= 0 && x < CHUNK_SIZE_X & z < CHUNK_SIZE_Z & y < CHUNK_SIZE_Y;
                let bi = null;
                if(in_chunk) {
                    bi = new Vector(x, y, z);
                    b = chunk.blocks[x][z][y];
                } else {
                    let offset = BLOCK.getChunkAddr(x, y, z);
                    chunk = vc.add(offset, () => {
                        let c = chunks[this.addr.add(offset).toChunkKey()];
                        if(!c) return null;
                        c.lightmap_temp = new Uint8Array(this.size.x * this.size.y * this.size.z);
                        return c;
                    });
                    if(!chunk) return;
                    bi = BLOCK.getBlockIndex(chunk.coord.x + x, chunk.coord.y + y, chunk.coord.z + z);
                    b = chunk.blocks[bi.x][bi.z][bi.y];
                }
                if(!b || (b.id == 0 || b.transparent)) {
                    // let index = BLOCK.getIndex(bi.x, bi.y, bi.z);
                    let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * bi.y + (bi.z * CHUNK_SIZE_X) + bi.x;
                    if(chunk.lightmap_temp[index] < power) {
                        chunk.lightmap_temp[index] = power;
                        fillLight(x, y, z, power);
                    }
                }
            };
            // Запуск заливки 6 соседей по разным направлениям
            f(lx + 1, ly, lz, power - 1);
            f(lx - 1, ly, lz, power - 1);
            f(lx, ly + 1, lz, power - 1);
            f(lx, ly - 1, lz, power - 1);
            f(lx, ly, lz + 1, power - 1);
            f(lx, ly, lz - 1, power - 1);
        };
        // Если у чанка есть свои источники света
        if(this.lights.length > 0) {
            // Each lights
            for(let light of this.lights) {
                let power = (light.power.a / 256 * MAX_TORCH_POWER) | 0;
                let index = BLOCK.getIndex(light.pos);
                this.lightmap_temp[index] = power;
                fillLight(light.pos.x, light.pos.y, light.pos.z, power);
            }
        }
        // Обход источников света в соседних чанках
        for(let x = -1; x <= 1; x++) {
            for(let y = -1; y <= 1; y++) {
                for(let z = -1; z <= 1; z++) {
                    if(x == 0 && y == 0 && z == 0) continue;
                    let vec = new Vector(x * CHUNK_SIZE_X, y * CHUNK_SIZE_Y, z * CHUNK_SIZE_Z);
                    let key = BLOCK.getChunkAddr(vec.add(this.coord)).toChunkKey();
                    let chunk = chunks[key];
                    if(chunk) {
                        for(let light of chunk.lights) {
                            let power = (light.power.a / 256 * MAX_TORCH_POWER) | 0;
                            let pos = light.pos.add(vec);
                            fillLight(pos.x, pos.y, pos.z, power);
                        }
                    }        
                }
            }
        }
        //
        this.lightmap = this.lightmap_temp;
        delete(this.lightmap_temp);
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

        if(!this.neighbour_chunks) {
            this.neighbour_chunks = {
                nx: world.chunkManager.getChunk(new Vector(this.addr.x - 1, this.addr.y, this.addr.z)),
                px: world.chunkManager.getChunk(new Vector(this.addr.x + 1, this.addr.y, this.addr.z)),
                ny: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y - 1, this.addr.z)),
                py: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y + 1, this.addr.z)),
                nz: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y, this.addr.z - 1)),
                pz: world.chunkManager.getChunk(new Vector(this.addr.x, this.addr.y, this.addr.z + 1))
            };
        }
        let neighbour_chunks = this.neighbour_chunks;

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

        //
        let getBlockStyleGroup = (block) => {
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
        };

        // Возвращает всех 6-х соседей блока
        let getBlockNeighbors = (x, y, z) => {
            let neighbors = {UP: null, DOWN: null, SOUTH: null, NORTH: null, WEST: null, EAST: null};
            let pcnt = 0;
            // обходим соседние блоки
            for(let p of cc) {
                let b = null;
                if(x > 0 && y > 0 && z > 0 && x < this.size.x - 1 && y < this.size.y - 1 && z < this.size.z - 1) {
                    // если сосед внутри того же чанка
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
                if(!b || (b.transparent || b.fluid)) {
                    // @нельзя прерывать, потому что нам нужно собрать всех "соседей"
                    // break;
                    pcnt = -40;
                }
                pcnt++;
            }
            neighbors.pcnt = pcnt;
            return neighbors;
        };

        // Обход всех блоков данного чанка
        for(let x = 0; x < this.size.x; x++) {
            for(let z = 0; z < this.size.z; z++) {
                let y_count = Math.min(this.size.y, this.blocks[x][z].length);
                for(let y = 0; y < y_count; y++) {
                    let block = this.blocks[x][z][y];
                    if(!block) {
                        continue;
                    }
                    if(typeof block === 'number') {
                        if(block == BLOCK.AIR.id) {
                            continue;
                        }
                        block = BLOCK.cloneFromId(block);
                        if(!block) {
                            throw 'Not found id in blocks `' + this.blocks[x][z][y] + '`';
                        }
                        this.blocks[x][z][y] = block;
                    }
                    //
                    if(!block.group) {
                        block.group = getBlockStyleGroup(block);
                    }
                }
            }
        }

        // Обход всех блоков данного чанка
        for(let x = 0; x < this.size.x; x++) {
            for(let z = 0; z < this.size.z; z++) {
                let y_count = Math.min(this.size.y, this.blocks[x][z].length);
                for(let y = 0; y < y_count; y++) {
                    let block = this.blocks[x][z][y];
                    if(!block || block.id == BLOCK.AIR.id) {
                        continue;
                    }
                    // собираем соседей блока, чтобы на этой базе понять, дальше отрисовывать стороны или нет
                    let neighbors = getBlockNeighbors(x, y, z);
                    // если у блока все соседи есть и они непрозрачные, значит блок невидно и ненужно отрисовывать
                    if(neighbors.pcnt == 6) {
                        continue;
                    }
                    // if block with gravity
                    // @todo Проверить с чанка выше (тут пока грязный хак с y > 0)
                    if(block.gravity && y > 0 && block.falling) {
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
                        block.vertices = [];
                        let biome = this.map.info.cells[x][z].biome;
                        BLOCK.pushVertices(block.vertices, block, this, this.lightmap, x, y, z, neighbors, biome);
                    }
                    world.blocks_pushed++;
                    if(block.vertices.length > 0) {
                        this.vertices[block.group].list.push(...block.vertices);
                    }
                }
            }
        }

        this.dirty = false;
        this.tm = performance.now() - tm;
        // this.lightmap = null;
        return true;
    }

    // Вызывается, когда какой нибудь блок уничтожили (вокруг него все блоки делаем испорченными)
    setDirtyBlocks(pos, find_neighbors) {
        let dirty_rad = MAX_TORCH_POWER;
        let vc = new VectorCollector();
        let cnt = 0;
        // let needUpdateLightmap = false;
        for(let cx = -dirty_rad; cx <= dirty_rad; cx++) {
            for(let cz = -dirty_rad; cz <= dirty_rad; cz++) {
                for(let cy = -dirty_rad; cy <= dirty_rad; cy++) {
                    let x = pos.x + cx;
                    let y = pos.y + cy;
                    let z = pos.z + cz;
                    //
                    let dist = pos.distance(new Vector(x, y, z));
                    if(dist > MAX_TORCH_POWER) continue;
                    if(x >= 0 && y >= 0 && z >= 0 && x < this.size.x && y < this.size.y && z < this.size.z) {
                        let block = this.blocks[x][z][y];
                        if(block && typeof block === 'object') {
                            if(block.gravity) {
                                if(cy == 1 && cx == 0 && cz == 0) {
                                    block.falling = true;
                                }
                            }
                            if(block.hasOwnProperty('vertices')) {
                                delete(block['vertices']);
                                cnt++;
                            }
                        }
                    } else if(find_neighbors) {
                        vc.add(BLOCK.getChunkAddr(x + this.coord.x, y + this.coord.y, z + this.coord.z), () => {});
                    }
                }
            }
        }
        this.findLights();
        // this.updateLights();
        return vc;
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
        VectorCollector = module.VectorCollector;
    });
    // load module
    await import("./blocks.js").then(module => {
        BLOCK = module.BLOCK;
        CHUNK_SIZE_X        = module.CHUNK_SIZE_X;
        CHUNK_SIZE_Y        = module.CHUNK_SIZE_Y;
        CHUNK_SIZE_Z        = module.CHUNK_SIZE_Z;
        CHUNK_BLOCKS        = module.CHUNK_BLOCKS;
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
            let pn = performance.now();
            for(let m of args) {
                if(chunks.hasOwnProperty(m.key)) {
                    // 1. Get chunk
                    let chunk = chunks[m.key];
                    // 2. Set new block
                    if(m.type) {
                        chunk.setBlock(m.x, m.y, m.z, m.type, m.is_modify, m.power, m.rotate, null, m.extra_data);
                    }
                    // 3. Clear vertices for new block and around near
                    let pos = new Vector(m.x - chunk.coord.x, m.y - chunk.coord.y, m.z - chunk.coord.z);
                    let neighbot_chunk_keys = chunk.setDirtyBlocks(pos, true);
                    // 4. Rebuild vertices list
                    result.push(buildVertices(chunk, false));
                    for(let pos of neighbot_chunk_keys.get()) {
                        let nc = chunks[pos.toChunkKey()];
                        if(nc) {
                            pos = new Vector(
                                m.x - nc.coord.x,
                                m.y - nc.coord.y,
                                m.z - nc.coord.z
                            );
                            nc.setDirtyBlocks(pos, false);
                            result.push(buildVertices(nc, false));
                        }
                    }
                }
            }
            // console.log(result.length, performance.now() - pn);
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