import {BLOCK} from "../blocks.js";
import {Vector} from "../helpers.js";
import {TypedBlocks, TBlock} from "../typed_blocks.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, getChunkAddr} from "../chunk.js";

// Consts
let MAX_TORCH_POWER = 16;

const CC = [
    {x:  0, y:  1, z:  0},
    {x:  0, y: -1, z:  0},
    {x:  0, y:  0, z: -1},
    {x:  0, y:  0, z:  1},
    {x: -1, y:  0, z:  0},
    {x:  1, y:  0, z:  0}
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

// Chunk
export class Chunk {

    constructor(chunkManager, args) {
        this.chunkManager = chunkManager;
        Object.assign(this, args);
        this.addr = new Vector(this.addr.x, this.addr.y, this.addr.z);
        this.size = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
        this.coord = new Vector(this.addr.x * CHUNK_SIZE_X, this.addr.y * CHUNK_SIZE_Y, this.addr.z * CHUNK_SIZE_Z);
        this.id = this.addr.toHash();
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
            rotate = new Vector(
                Math.round(rotate.x * 10) / 10,
                Math.round(rotate.y * 10) / 10,
                Math.round(rotate.z * 10) / 10
            );
        } else {
            rotate = null;
        }
        // fix power
        if(typeof power === 'undefined' || power === null) {
            power = 1.0;
        }
        power = Math.round(power * 10000) / 10000;
        if(power <= 0) {
            return;
        }
        //
        if(orig_type.id < 3) {
            power       = null;
            rotate      = null;
            extra_data  = null;
        }
        if(power == 1) power = null;
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
    }

    // Возвращает всех 6-х соседей блока
    /**
     * 
     * @param {Vector} pos 
     * @returns 
     */
    getBlockNeighbours(pos, cache = null) {

        const neighbours = {
            pcnt: 0,
            UP: null,
            DOWN: null,
            SOUTH: null,
            NORTH: null,
            WEST: null,
            EAST: null
        };

        neighbours.pcnt = 0;

        // обходим соседние блоки
        for(let i = 0; i < 6; i ++) {

            const p = CC[i];
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

            if(p.y == 1) {
                neighbours.UP = b;
            } else if(p.y == -1) {
                neighbours.DOWN = b;
            } else if(p.z == -1) {
                neighbours.SOUTH = b;
            } else if(p.z == 1) {
                neighbours.NORTH = b;
            } else if(p.x == -1) {
                neighbours.WEST = b;
            } else if(p.x == 1) {
                neighbours.EAST = b;
            }

            let properties = b?.properties;
            if(!properties || properties.transparent || properties.fluid) {
                // @нельзя прерывать, потому что нам нужно собрать всех "соседей"
                // break;
                neighbours.pcnt = -40;
            }
            neighbours.pcnt++;
        }

        return neighbours;
    }

    // buildVertices
    buildVertices() {

        if(!this.dirty || !this.tblocks || !this.coord) {
            return false;
        }

        // Create map of lowest blocks that are still lit
        let tm                  = performance.now();
        this.fluid_blocks       = [];
        this.gravity_blocks     = [];

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

        const tmpVector = new Vector();

        // Add vertices for blocks
        this.vertices = new Map();

        this.neighbour_chunks = {
            nx: world.chunkManager.getChunk(tmpVector.set(this.addr.x - 1, this.addr.y, this.addr.z)),
            px: world.chunkManager.getChunk(tmpVector.set(this.addr.x + 1, this.addr.y, this.addr.z)),
            ny: world.chunkManager.getChunk(tmpVector.set(this.addr.x, this.addr.y - 1, this.addr.z)),
            py: world.chunkManager.getChunk(tmpVector.set(this.addr.x, this.addr.y + 1, this.addr.z)),
            nz: world.chunkManager.getChunk(tmpVector.set(this.addr.x, this.addr.y, this.addr.z - 1)),
            pz: world.chunkManager.getChunk(tmpVector.set(this.addr.x, this.addr.y, this.addr.z + 1))
        };

        const cache = BLOCK_CACHE;
        const blockIter = this.tblocks.createUnsafeIterator(new TBlock(null, new Vector(0,0,0)));
        let material = null;

        // Обход всех блоков данного чанка
        for(let block of blockIter) {
            material = block.material;
            if(block.id == BLOCK.AIR.id || !material || material.item) {
                continue;
            }
            // собираем соседей блока, чтобы на этой базе понять, дальше отрисовывать стороны или нет
            let neighbours = this.getBlockNeighbours(block.pos, cache);
            // если у блока все соседи есть и они непрозрачные, значит блок невидно и ненужно отрисовывать
            if(neighbours.pcnt == 6) {
                continue;
            }
            /*
            // if block with gravity
            // @todo Проверить с чанка выше (тут пока грязный хак с y > 0)
            if(material.gravity && block.pos.y > 0 && block.falling) {
                let block_under = this.tblocks.get(block.pos.sub(new Vector(0, 1, 0)));
                if([BLOCK.AIR.id, BLOCK.GRASS.id].indexOf(block_under.id) >= 0) {
                    this.gravity_blocks.push(block.pos);
                }
            }
            // if block is fluid
            if(material.fluid) {
                this.fluid_blocks.push(block.pos);
            }
            */
            if(material.id == 202
                && (neighbours.UP?.id || 0) == 202
                && (neighbours.DOWN?.id || 0) == 202
                && (neighbours.SOUTH?.id || 0) == 202
                && (neighbours.NORTH?.id || 0) == 202
                && (neighbours.EAST?.id || 0) == 202
                && (neighbours.WEST?.id || 0) == 202) {
                    continue;
            }
            if(block.vertices === null) {
                block.vertices = [];
                material.resource_pack.pushVertices(
                    block.vertices,
                    block, // UNSAFE! If you need unique block, use clone
                    this,
                    block.pos.x,
                    block.pos.y,
                    block.pos.z,
                    neighbours,
                    this.map.info.cells[block.pos.x][block.pos.z].biome
                );
            }
            world.blocks_pushed++;
            if(block.vertices !== null && block.vertices.length > 0) {
                if(!this.vertices.has(material.material_key)) {
                    // {...group_templates[material.group]}; -> Не работает так! list остаётся ссылкой на единый массив!
                    this.vertices.set(material.material_key, JSON.parse(JSON.stringify(group_templates[material.group])));
                }
                // Push vertices
                this.vertices.get(material.material_key).list.push(...block.vertices);
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
        let dirty_rad = MAX_TORCH_POWER;
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
