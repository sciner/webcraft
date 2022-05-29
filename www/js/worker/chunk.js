import {BLOCK, POWER_NO} from "../blocks.js";
import {Vector, VectorCollector} from "../helpers.js";
import {BlockNeighbours, TBlock} from "../typed_blocks.js";
import {newTypedBlocks, DataWorld} from "../typed_blocks3.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, getChunkAddr} from "../chunk.js";
import { AABB } from '../core/AABB.js';
import { ClusterManager } from '../terrain_generator/cluster/manager.js';

// Constants
const DIRTY_REBUILD_RAD = 1;
const BLOCK_CACHE = Array.from({length: 6}, _ => new TBlock(null, new Vector(0,0,0)));

// ChunkManager
export class ChunkManager {

    constructor(world) {
        this.world = world;
        this.clusterManager = new ClusterManager(this, world.generator.seed);
        this.DUMMY = {
            id: BLOCK.DUMMY.id,
            shapes: [],
            properties: BLOCK.DUMMY,
            material: BLOCK.DUMMY,
            getProperties: function() {
                return this.properties;
            }
        };
        this.dataWorld = new DataWorld();
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

// Chunk
export class Chunk {

    constructor(chunkManager, args) {
        this.chunkManager   = chunkManager;
        Object.assign(this, args);
        this.addr           = new Vector(this.addr.x, this.addr.y, this.addr.z);
        this.size           = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
        this.coord          = new Vector(this.addr.x * CHUNK_SIZE_X, this.addr.y * CHUNK_SIZE_Y, this.addr.z * CHUNK_SIZE_Z);
        this.id             = this.addr.toHash();
        this.ticking_blocks = new VectorCollector();
        this.emitted_blocks = new VectorCollector();
        this.temp_vec2      = new Vector(0, 0, 0);
        this.cluster        = chunkManager.clusterManager.getForCoord(this.coord);
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

        this.tblocks = newTypedBlocks(this.coord, this.size);
        this.chunkManager.dataWorld.addChunk(this);
        //
        this.timers.init = Math.round((performance.now() - this.timers.init) * 1000) / 1000;
        // 2. Generate terrain
        this.timers.generate_terrain = performance.now();
        this.map = this.chunkManager.world.generator.generate(this);
        this.chunkManager.dataWorld.syncOuter(this);
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
        }
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

    // Set block indirect
    setBlockIndirect(x, y, z, block_id, rotate, extra_data) {
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        this.id[index] = id;
        if (rotate || extra_data) {
            this.tblocks.setBlockRotateExtra(x, y, z, rotate, extra_data);
        }
    }

    // buildVertices
    buildVertices() {

        if(!this.dirty || !this.tblocks || !this.coord) {
            return false;
        }

        // Create map of lowest blocks that are still lit
        let tm = performance.now();

        this.neighbour_chunks = this.tblocks.getNeightboursChunks(world);

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

        const cache                 = BLOCK_CACHE;
        const blockIter             = this.tblocks.createUnsafeIterator(new TBlock(null, new Vector(0,0,0)), true);

        this.quads = 0;

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
            let neighbours = block.getNeighbours(world, cache);
            // если у блока все соседи есть и они непрозрачные, значит блок невидно и ненужно отрисовывать
            if(neighbours.pcnt == 6 || neighbours.water_in_water) {
                continue;
            }
            let vertices = block.vertices;
            if(vertices === null) {
                vertices = [];
                const cell = this.map.cells[block.pos.z * CHUNK_SIZE_X + block.pos.x];
                const resp = material.resource_pack.pushVertices(
                    vertices,
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
                block.vertices = vertices;
            }
            world.blocks_pushed++;
            if(vertices.length > 0) {
                this.quads++;
                addVerticesToGroup(material.group, material.material_key, vertices);
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
                        eb.dirt_color,
                        null,
                        null,
                        eb.matrix,
                        eb.pivot
                    );
                    if(vertices.length > 0) {
                        this.quads++;
                        addVerticesToGroup(material.group, material.material_key, vertices);
                    }
                }
            }
        }

        /*for(let k of this.vertices.keys()) {
            const group = this.vertices.get(k);
            group.list = new Float32Array(group.list);
        }*/

        // console.log(this.quads);
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
