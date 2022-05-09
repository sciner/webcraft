import {BLOCK, POWER_NO, WATER_BLOCKS_ID} from "../blocks.js";
import {Color, Vector, VectorCollector} from "../helpers.js";
import {TypedBlocks, TBlock} from "../typed_blocks.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, getChunkAddr} from "../chunk.js";
import { AABB } from '../core/AABB.js';

// Constants
const DIRTY_REBUILD_RAD = 1;

const CC = [
    {x:  0, y:  1, z:  0, name: 'UP'},
    {x:  0, y: -1, z:  0, name: 'DOWN'},
    {x:  0, y:  0, z: -1, name: 'SOUTH'},
    {x:  0, y:  0, z:  1, name: 'NORTH'},
    {x: -1, y:  0, z:  0, name: 'WEST'},
    {x:  1, y:  0, z:  0, name: 'EAST'}
];

const BLOCK_CACHE = Array.from({length: 6}, _ => new TBlock(null, new Vector(0,0,0)));

// ChunkManager
export class ChunkManager {

    constructor(world) {
        this.world = world;
        this.DUMMY = {
            id: BLOCK.DUMMY.id,
            shapes: [],
            properties: BLOCK.DUMMY,
            material: BLOCK.DUMMY,
            getProperties: function() {
                return this.properties;
            }
        };
    }

    // Get
    getChunk(addr) {
        return this.world.chunks.get(addr);
    }

    // Возвращает блок по абсолютным координатам
    getBlock(x, y, z) {
        // определяем относительные координаты чанка
        let chunkAddr = getChunkAddr(x, y, z);
        // обращаемся к чанку
        let chunk = this.getChunk(chunkAddr);
        // если чанк найден
        if(chunk) {
            // просим вернуть блок передав абсолютные координаты
            return chunk.getBlock(x, y, z);
        }
        return this.DUMMY;
    }

}

export class BlockNeighbours {

    constructor() {
        this.pcnt   = 0;
        this.UP     = null;
        this.DOWN   = null;
        this.SOUTH  = null;
        this.NORTH  = null;
        this.WEST   = null;
        this.EAST   = null;
    }

}

// Chunk
export class Chunk {

    constructor(chunkManager, args) {
        this.chunkManager = chunkManager;
        Object.assign(this, args);
        this.addr           = new Vector(this.addr.x, this.addr.y, this.addr.z);
        this.size           = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
        this.coord          = new Vector(this.addr.x * CHUNK_SIZE_X, this.addr.y * CHUNK_SIZE_Y, this.addr.z * CHUNK_SIZE_Z);
        this.id             = this.addr.toHash();
        this.ticking_blocks = new VectorCollector();
        this.emitted_blocks = new VectorCollector();
        this.cluster        = ClusterManager.getForCoord(this.coord);
        this.aabb           = new AABB();
        this.aabb.set(
            this.coord.x,
            this.coord.y,
            this.coord.z,
            this.coord.x + this.size.x,
            this.coord.y + this.size.y,
            this.coord.z + this.size.z
        );
    }

    init() {
        // Variables
        this.vertices_length    = 0;
        this.vertices           = new Map();
        this.dirty              = true;
        this.fluid_blocks       = [];
        this.gravity_blocks     = [];
        this.timers             = {
            init:               null,
            generate_terrain:   null,
            apply_modify:       null,
            build_vertices:     null
        };
        // 1. Initialise world array
        this.timers.init = performance.now();
        this.tblocks = new TypedBlocks(this.coord);
        //
        this.timers.init = Math.round((performance.now() - this.timers.init) * 1000) / 1000;
        // 2. Generate terrain
        this.timers.generate_terrain = performance.now();
        this.map = this.chunkManager.world.generator.generate(this);
        this.timers.generate_terrain = Math.round((performance.now() - this.timers.generate_terrain) * 1000) / 1000;
        // 3. Apply modify_list
        this.timers.apply_modify = performance.now();
        this.applyModifyList();
        this.timers.apply_modify = Math.round((performance.now() - this.timers.apply_modify) * 1000) / 1000;
        // 4. Result
        return {
            key:        this.key,
            addr:       this.addr,
            tblocks:    this.tblocks,
            map:        this.map
        };
    }

    addTickingBlock(pos) {
        this.ticking_blocks.set(pos, pos);
    }

    deleteTickingBlock(pos) {
        this.ticking_blocks.delete(pos);
    }

    //
    applyModifyList() {
        if(!this.modify_list) {
            return;
        }
        const pos = new Vector(0, 0, 0);
        const block_index = new Vector(0, 0, 0);
        for(let key of Object.keys(this.modify_list)) {
            let m           = this.modify_list[key];
            let pos_temp         = key.split(',');
            pos.set(pos_temp[0], pos_temp[1], pos_temp[2])
            if(m.id < 1) {
                BLOCK.getBlockIndex(pos, null, null, block_index);
                this.tblocks.delete(block_index);
                continue;
            }
            let type        = BLOCK.fromId(m.id);
            let rotate      = m.rotate ? m.rotate : null;
            let entity_id   = m.entity_id ? m.entity_id : null;
            let extra_data  = m.extra_data ? m.extra_data : null;
            this.setBlock(pos.x | 0, pos.y | 0, pos.z | 0, type, false, m.power, rotate, entity_id, extra_data);
        }
        this.modify_list = [];
    }

    // Get the type of the block at the specified position.
    // Mostly for neatness, since accessing the array
    // directly is easier and faster.
    getBlock(ox, oy, oz) {
        let x = ox - this.coord.x;
        let y = oy - this.coord.y;
        let z = oz - this.coord.z;
        if(x < 0 || y < 0 || x > this.size.x - 1 || y > this.size.y - 1 || z > this.size.z - 1) {
            return world.chunkManager.DUMMY;
        };
        if(z < 0 || z >= this.size.y) {
            return world.chunkManager.DUMMY;
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
            return BLOCK.AIR;
        }
        return block || world.chunkManager.DUMMY;
    }

    // setBlock
    setBlock(x, y, z, orig_type, is_modify, power, rotate, entity_id, extra_data) {
        // fix rotate
        if(rotate && typeof rotate === 'object') {
            rotate = new Vector(rotate).roundSelf(1);
        } else {
            rotate = null;
        }
        // fix power
        if(typeof power === 'undefined' || power === null) {
            power = POWER_NO;
        }
        //
        if(orig_type.id < 3) {
            power       = null;
            rotate      = null;
            extra_data  = null;
        }
        if(power === 0) {
            power = null;
        }
        //
        if(is_modify) {
            let modify_item = {
                id: orig_type.id,
                power: power,
                rotate: rotate
            };
            this.modify_list[[x, y, z]] = modify_item;
        }
        let pos = new Vector(x, y, z);
        BLOCK.getBlockIndex(pos, null, null, pos);
        x = pos.x;
        y = pos.y;
        z = pos.z;
        if(x < 0 || y < 0 || z < 0 || x > this.size.x - 1 || y > this.size.y - 1 || z > this.size.z - 1) {
            return;
        };
        if(is_modify) {
            console.table(orig_type);
        }
        let block        = this.tblocks.get(pos);
        block.id         = orig_type.id;
        block.power      = power;
        block.rotate     = rotate;
        block.entity_id  = entity_id;
        block.texture    = null;
        block.extra_data = extra_data;
        this.emitted_blocks.delete(block.pos);
    }

    // Возвращает всех 6-х соседей блока
    /**
     * 
     * @param {Vector} pos 
     * @returns 
     */
    getBlockNeighbours(pos, cache = null) {

        const neighbours = new BlockNeighbours();

        // обходим соседние блоки
        let i = 0;
        for(let p of CC) {

            const cb = (cache && cache[i]) || new TBlock(null, new Vector());
            const v = cb.vec;
            const ax = pos.x + p.x;
            const ay = pos.y + p.y;
            const az = pos.z + p.z;
            
            let b;

            if(ax < 0) {
                b = this.neighbour_chunks.nx.tblocks.get(v.set(this.size.x - 1, pos.y, pos.z), cb);
            } else if(az < 0) {
                b = this.neighbour_chunks.nz.tblocks.get(v.set(pos.x, pos.y, this.size.z - 1), cb);
            } else if(ay < 0) {
                b = this.neighbour_chunks.ny?.tblocks.get(v.set(pos.x, this.size.y - 1, pos.z), cb);
            } else if(ay >= this.size.y) {
                b = this.neighbour_chunks.py.tblocks.get(v.set(pos.x, 0, pos.z), cb);
            } else if(ax >= this.size.x) {
                b = this.neighbour_chunks.px.tblocks.get(v.set(0, pos.y, pos.z), cb);
            } else if(az >= this.size.z) {
                b = this.neighbour_chunks.pz.tblocks.get(v.set(pos.x, pos.y, 0), cb);
            } else {
                b = this.tblocks.get(v.set(ax, ay, az), cb);
            }

            neighbours[p.name] = b;

            let properties = b?.properties;
            if(!properties || properties.transparent || properties.fluid) {
                // @нельзя прерывать, потому что нам нужно собрать всех "соседей"
                // break;
                neighbours.pcnt = -40;
            }
            neighbours.pcnt++;
            i++;
        }

        return neighbours;
    }

    // buildVertices
    buildVertices() {

        if(!this.dirty || !this.tblocks || !this.coord) {
            return false;
        }

        // Create map of lowest blocks that are still lit
        let tm = performance.now();

        const tmpVector = new Vector();

        this.neighbour_chunks = {
            nx: world.chunkManager.getChunk(tmpVector.set(this.addr.x - 1, this.addr.y, this.addr.z)),
            px: world.chunkManager.getChunk(tmpVector.set(this.addr.x + 1, this.addr.y, this.addr.z)),
            ny: world.chunkManager.getChunk(tmpVector.set(this.addr.x, this.addr.y - 1, this.addr.z)),
            py: world.chunkManager.getChunk(tmpVector.set(this.addr.x, this.addr.y + 1, this.addr.z)),
            nz: world.chunkManager.getChunk(tmpVector.set(this.addr.x, this.addr.y, this.addr.z - 1)),
            pz: world.chunkManager.getChunk(tmpVector.set(this.addr.x, this.addr.y, this.addr.z + 1))
        };

        // Check neighbour chunks available
        if(!this.neighbour_chunks.nx || !this.neighbour_chunks.px || !this.neighbour_chunks.ny || !this.neighbour_chunks.py || !this.neighbour_chunks.nz || !this.neighbour_chunks.pz) {
            this.tm                 = performance.now() - tm;
            this.neighbour_chunks   = null;
            console.error('todo_unobtainable_chunk');
            return false;
        }

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

        this.fluid_blocks           = [];
        this.gravity_blocks         = [];
        this.vertices               = new Map(); // Add vertices for blocks

        // addVerticesToGroup...
        const addVerticesToGroup = (material_group, material_key, vertices) => {
            if(!this.vertices.has(material_key)) {
                // {...group_templates[material.group]}; -> Не работает так! list остаётся ссылкой на единый массив!
                this.vertices.set(material_key, JSON.parse(JSON.stringify(group_templates[material_group])));
            }
            // Push vertices
            this.vertices.get(material_key).list.push(...vertices);
        };

        const waterInWater = function(material, neighbours) {
            if(material.is_water) {
                let n1 = neighbours.UP?.material.is_water;
                let n2 = neighbours.DOWN?.material.is_water
                let n3 = neighbours.SOUTH?.material.is_water
                let n4 = neighbours.NORTH?.material.is_water
                let n5 = neighbours.EAST?.material.is_water
                let n6 = neighbours.WEST?.material.is_water
                if(n1 && n2 && n3 && n4 && n5 && n6) {
                    return true;
                }
            }
            return false;
        }

        const cache                 = BLOCK_CACHE;
        const blockIter             = this.tblocks.createUnsafeIterator(new TBlock(null, new Vector(0,0,0)));

        // Обход всех блоков данного чанка
        for(let block of blockIter) {
            const material = block.material;
            // @todo iterator not fired air blocks
            if(block.id == BLOCK.AIR.id || !material || material.item) {
                if(this.emitted_blocks.has(block.pos)) {
                    this.emitted_blocks.delete(block.pos);
                }
                continue;
            }
            // собираем соседей блока, чтобы на этой базе понять, дальше отрисовывать стороны или нет
            let neighbours = this.getBlockNeighbours(block.pos, cache);
            // если у блока все соседи есть и они непрозрачные, значит блок невидно и ненужно отрисовывать
            if(neighbours.pcnt == 6) {
                continue;
            }
            //
            if(waterInWater(material, neighbours)) {
                continue;
            }
            if(block.vertices === null) {
                block.vertices = [];
                const cell = this.map.cells[block.pos.z * CHUNK_SIZE_X + block.pos.x];
                const resp = material.resource_pack.pushVertices(
                    block.vertices,
                    block, // UNSAFE! If you need unique block, use clone
                    this,
                    block.pos,
                    neighbours,
                    cell.biome,
                    cell.dirt_color
                );
                if(Array.isArray(resp)) {
                    this.emitted_blocks.set(block.pos, resp);
                } else if(this.emitted_blocks.size > 0) {
                    this.emitted_blocks.delete(block.pos);
                }
            }
            world.blocks_pushed++;
            if(block.vertices.length > 0) {
                addVerticesToGroup(material.group, material.material_key, block.vertices);
            }
        }

        // Emmited blocks
        if(this.emitted_blocks.size > 0) {
            const fake_neighbours = new BlockNeighbours();
            for(let eblocks of this.emitted_blocks) {
                for(let eb of eblocks) {
                    let vertices = [];
                    const material = eb.material;
                    // vertices, block, world, pos, neighbours, biome, dirt_color, draw_style, force_tex, _matrix, _pivot
                    material.resource_pack.pushVertices(
                        vertices,
                        eb,
                        this,
                        eb.pos,
                        fake_neighbours,
                        eb.biome,
                        null,
                        null,
                        null,
                        eb.matrix,
                        eb.pivot
                    );
                    addVerticesToGroup(material.group, material.material_key, vertices);
                }
            }
        }

        this.dirty = false;
        this.tm = performance.now() - tm;
        this.neighbour_chunks = null;
        return true;

    }

    // setDirtyBlocks
    // Вызывается, когда какой нибудь блок уничтожили (вокруг него все блоки делаем испорченными)
    setDirtyBlocks(pos) {
        let dirty_rad = DIRTY_REBUILD_RAD;
        let cnt = 0;
        for(let cx = -dirty_rad; cx <= dirty_rad; cx++) {
            for(let cz = -dirty_rad; cz <= dirty_rad; cz++) {
                for(let cy = -dirty_rad; cy <= dirty_rad; cy++) {
                    let x = pos.x + cx;
                    let y = pos.y + cy;
                    let z = pos.z + cz;
                    if(x >= 0 && y >= 0 && z >= 0 && x < this.size.x && y < this.size.y && z < this.size.z) {
                        let pos = new Vector(x, y, z);
                        if(this.tblocks.has(pos)) {
                            let block = this.tblocks.get(pos);
                            if(block.material.gravity) {
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
        return cnt;
    }

}
