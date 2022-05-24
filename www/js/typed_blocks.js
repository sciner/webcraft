import {Vector, VectorCollector} from "./helpers.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_SIZE, getChunkAddr} from "./chunk.js";
import {BLOCK, POWER_NO} from "./blocks.js";

export const CC = [
    {x:  0, y:  1, z:  0, name: 'UP'},
    {x:  0, y: -1, z:  0, name: 'DOWN'},
    {x:  0, y:  0, z: -1, name: 'SOUTH'},
    {x:  0, y:  0, z:  1, name: 'NORTH'},
    {x: -1, y:  0, z:  0, name: 'WEST'},
    {x:  1, y:  0, z:  0, name: 'EAST'}
];

// BlockNeighbours
export class BlockNeighbours {

    constructor() {
        this.pcnt   = 6;
        this.UP     = null;
        this.DOWN   = null;
        this.SOUTH  = null;
        this.NORTH  = null;
        this.WEST   = null;
        this.EAST   = null;
    }

}

export class TBlock {

    constructor(tb, vec) {
        this.init(tb, vec);
    }

    init(tb = this.tb, vec = this.vec) {
        this.tb = tb;
        this.vec = vec;
        this.index = this.vec ? BLOCK.getIndex(this.vec) : NaN;
        return this;
    }

    get posworld() {
        return this.vec.add(this.tb.coord);
    }

    //
    get pos() {
        return this.vec;
    }

    //
    get id() {
        return this.tb.id[this.index];
    }
    set id(value) {
        // let cu = this.tb.id[this.index];
        // this.tb.non_zero += (!cu && value) ? 1 : ((cu && !value) ? -1 : 0);
        this.tb.id[this.index] = value;
    }

    //
    get power() {
        let resp = this.tb.power.get(this.vec);
        if(resp === null) resp = POWER_NO;
        return resp;
    }
    set power(value) {
        if(value) return this.tb.power.set(this.vec, value);
        this.tb.power.delete(this.vec);
    }

    //
    get rotate() {
        return this.tb.rotate.get(this.vec);
    }
    set rotate(value) {
        if(value) return this.tb.rotate.set(this.vec, value);
        this.tb.rotate.delete(this.vec);
    }

    // entity_id
    get entity_id() {
        return this.tb.entity_id.get(this.vec);
    }
    set entity_id(value) {
        if(value) return this.tb.entity_id.set(this.vec, value);
        this.tb.entity_id.delete(this.vec);
    }

    // texture
    get texture() {
        return this.tb.texture.get(this.vec);
    }
    set texture(value) {
        if(value) return this.tb.texture.set(this.vec, value);
        this.tb.texture.delete(this.vec);
    }

    // extra_data
    get extra_data() {
        return this.tb.extra_data.get(this.vec);
    }
    set extra_data(value) {
        if(value) return this.tb.extra_data.set(this.vec, value);
        this.tb.extra_data.delete(this.vec);
    }

    // falling
    get falling() {
        return this.tb.falling.get(this.vec);
    }
    set falling(value) {
        if(value) return this.tb.falling.set(this.vec, value);
        this.tb.falling.delete(this.vec);
    }

    // vertices
    get vertices() {
        return this.tb.vertices.get(this.vec);
    }
    set vertices(value) {
        if(value !== null) return this.tb.vertices.set(this.vec, value);
        this.tb.vertices.delete(this.vec);
    }

    // shapes
    get shapes() {
        return this.tb.shapes.get(this.vec);
    }
    set shapes(value) {
        if(value) return this.tb.shapes.set(this.vec, value);
        this.tb.shapes.delete(this.vec);
    }

    // properties
    get properties() {
        return BLOCK.BLOCK_BY_ID.get(this.id) || null;
    }

    // material
    get material() {
        return BLOCK.BLOCK_BY_ID.get(this.id) || null;
    }

    //
    getCardinalDirection() {
        return BLOCK.getCardinalDirection(this.rotate);
    }

    // Дальнейшие свойства нужны только для prismarine-physics (физика перса)
    //
    get type() {
        return this.id;
    }
    getProperties() {
        return this.properties;
    }
    // position
    get position() {
        // return new Vector(this.vec.x + this.tb.coord.x, this.vec.y + this.tb.coord.y, this.vec.z + this.tb.coord.z);
        return this.tb.position.get(this.vec);
    }
    set position(value) {
        if(value) return this.tb.position.set(this.vec, value);
        this.tb.position.delete(this.vec);
    }
    get metadata() {
        return this.tb.metadata.get(this.vec);
    }

    getSound() {
        let sound = null;
        if(this.id) {
            let mat = this.material;
            sound = mat.hasOwnProperty('sound') ? mat.sound : null;
        }
        return sound;
    }

    isPlant() {
        return this.material.planting;
    }

    canReplace() {
        return BLOCK.canReplace(this.id, this.extra_data);
    }

    hasTag(tag) {
        let mat = this.material;
        return mat.tags && mat.tags.indexOf(tag) >= 0;
    }

    convertToDBItem() {
        return BLOCK.convertItemToDBItem(this);
    }

    /**
     * Возвращает всех 6-х соседей блока
     * @param {Vector} pos 
     * @param {Array} cache 
     * @returns 
     */
    getNeighbours(world, cache) {
        const neighbours = new BlockNeighbours();
        const nc = this.tb.getNeightboursChunks(world);
        const pos = this.vec;
        let chunk;
        // обходим соседние блоки
        for (let i = 0; i < CC.length; i++) {
            const p = CC[i];
            const cb = cache[i]; // (cache && cache[i]) || new TBlock(null, new Vector());
            const v = cb.vec;
            const ax = pos.x + p.x;
            const ay = pos.y + p.y;
            const az = pos.z + p.z;
            if(ax >= 0 && ay >= 0 && az >= 0 && ax < CHUNK_SIZE_X && ay < CHUNK_SIZE_Y && az < CHUNK_SIZE_Z) {
                v.x = ax;
                v.y = ay;
                v.z = az;
                chunk = nc.that.chunk;
            } else {
                v.x = (pos.x + p.x + CHUNK_SIZE_X) % CHUNK_SIZE_X;
                v.y = (pos.y + p.y + CHUNK_SIZE_Y) % CHUNK_SIZE_Y;
                v.z = (pos.z + p.z + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
                if(ax < 0) {
                    chunk = nc.nx.chunk;
                } else if(ay < 0) {
                    chunk = nc.ny.chunk;
                } else if(az < 0) {
                    chunk = nc.nz.chunk;
                } else if(ax >= CHUNK_SIZE_X) {
                    chunk = nc.px.chunk;
                } else if(ay >= CHUNK_SIZE_Y) {
                    chunk = nc.py.chunk;
                } else if(az >= CHUNK_SIZE_Z) {
                    chunk = nc.pz.chunk;
                }
            }
            const b = neighbours[p.name] = chunk.tblocks.get(v, cb);
            const properties = b?.properties;
            if(!properties || properties.transparent || properties.fluid) {
                // @нельзя прерывать, потому что нам нужно собрать всех "соседей"
                neighbours.pcnt--;
            }
        }
        return neighbours;
    }

}

// TypedBlocks
export class TypedBlocks {

    #neightbours_chunks;

    constructor(coord, block_count = CHUNK_SIZE) {
        this.addr       = getChunkAddr(coord);
        this.coord      = coord;
        this.count      = block_count;
        this.id         = new Uint16Array(this.count);
        this.power      = new VectorCollector();
        this.rotate     = new VectorCollector();
        this.entity_id  = new VectorCollector();
        this.texture    = new VectorCollector();
        this.extra_data = new VectorCollector();
        this.vertices   = new VectorCollector();
        this.falling    = new VectorCollector();
        //
        this.shapes     = new VectorCollector();
        this.metadata   = new VectorCollector();
        this.position   = new VectorCollector();
        this.non_zero   = 0;
    }

    //
    getNeightboursChunks(world) {
        if(this.#neightbours_chunks) {
            return this.#neightbours_chunks;
        }
        //
        const nc = this.#neightbours_chunks = {
            // center
            that: {addr: this.addr, chunk: null},
            // sides
            nx: {addr: new Vector(this.addr.x - 1, this.addr.y, this.addr.z), chunk: null},
            px: {addr: new Vector(this.addr.x + 1, this.addr.y, this.addr.z), chunk: null},
            ny: {addr: new Vector(this.addr.x, this.addr.y - 1, this.addr.z), chunk: null},
            py: {addr: new Vector(this.addr.x, this.addr.y + 1, this.addr.z), chunk: null},
            nz: {addr: new Vector(this.addr.x, this.addr.y, this.addr.z - 1), chunk: null},
            pz: {addr: new Vector(this.addr.x, this.addr.y, this.addr.z + 1), chunk: null}
        };
        //
        for(let i in this.#neightbours_chunks) {
            const n = this.#neightbours_chunks[i];
            n.chunk = world.chunkManager.getChunk(n.addr);
        }
        return nc;
    }

    // Restore state
    restoreState(state, refresh_non_zero = false) {
        this.id         = state.id; // new Uint16Array(state.id);
        this.power      = new VectorCollector(state.power.list);
        this.rotate     = new VectorCollector(state.rotate.list);
        this.entity_id  = new VectorCollector(state.entity_id.list);
        this.texture    = new VectorCollector(state.texture.list);
        this.extra_data = new VectorCollector(state.extra_data.list);
        this.vertices   = new VectorCollector(state.vertices.list);
        this.shapes     = new VectorCollector(state.shapes.list);
        this.falling    = new VectorCollector(state.falling.list);
        if(refresh_non_zero) {
            this.refreshNonZero();
        }
    }

    //
    refreshNonZero() {
        this.non_zero = 0;
        for(let i = 0; i < this.count; i++) {
            if(this.id[i] != 0) {
                this.non_zero++;
            }
        }
        return this.non_zero;
    }

    // DIAMOND_ORE // 56
    // REDSTONE_ORE // 73
    // GOLD_ORE // 14
    // IRON_ORE // 15
    // COAL_ORE // 16
    isFilled(id) {
        return (id >= 2 && id <= 3) ||
                id == 9 || id == 56 || id == 73 ||
                (id >= 14 && id <= 16) ||
                (id >= 545 && id <= 550);
    }

    isWater(id) {
        return id == 200 || id == 202;
    }

    //
    blockIsClosed(index, id, x, y, z) {
        const max_count = this.count;
        const i_up = index + CHUNK_SIZE_X * CHUNK_SIZE_Z;
        const i_down = index - CHUNK_SIZE_X * CHUNK_SIZE_Z;
        const i_north = index + CHUNK_SIZE_X;
        const i_south = index - CHUNK_SIZE_X;
        const i_east = index + 1;
        const i_west = index - 1;
        if(i_up < max_count && i_north < max_count && i_east < max_count && i_down > -1 && i_south > -1 && i_west > -1) {
            const is_filled = this.isFilled(id);
            const is_water = false; // this.isWater(id);
            if(is_filled || is_water) {
                const id_up = this.id[i_up];
                const id_down = this.id[i_down];
                const id_north = this.id[i_north];
                const id_south = this.id[i_south];
                const id_west = this.id[i_west];
                const id_east = this.id[i_east];
                if(is_filled) {
                    if(this.isFilled(id_up) && this.isFilled(id_down) && this.isFilled(id_south) && this.isFilled(id_north) && this.isFilled(id_west) && this.isFilled(id_east)) {
                        return true;
                    }
                } /*else if(is_water) {
                    if(this.isWater(id_up) && this.isWater(id_down) && this.isWater(id_south) && this.isWater(id_north) && this.isWater(id_west) && this.isWater(id_east)) {
                        return true;
                    }
                }*/
            }
        }
        return false;
    }

    /**
     * Creating iterator that fill target block to reduce allocations 
     * NOTE! This unsafe because returned block will be re-filled in iteration process
     * @param {TBlock} target 
     * @returns 
     */
    createUnsafeIterator(target = null, ignore_filled = false) {
        const b = target || new TBlock(this, new Vector());
        const contex = this;
        return (function* () {
            // if(!globalThis.dfgdfg) globalThis.dfgdfg = 0;
            for(let index = 0; index < contex.count; index++) {
                const id = contex.id[index];
                if (!id) {
                    continue;
                }
                // let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
                let x = index % CHUNK_SIZE_X;
                let y = index / (CHUNK_SIZE_X * CHUNK_SIZE_Z) | 0;
                let z = ((index) % (CHUNK_SIZE_X * CHUNK_SIZE_Z) - x) / CHUNK_SIZE_X;
                if(ignore_filled) {
                    if(x > 0 && y > 0 && z > 0 && x < CHUNK_SIZE_X - 1 && y < CHUNK_SIZE_Y - 1 && z < CHUNK_SIZE_Z - 1) {
                        if(contex.blockIsClosed(index, id, x, y, z)) {
                            // globalThis.dfgdfg++
                            continue;
                        }
                    }
                }
                let vec = b.vec.set(x, y, z);
                yield b.init(contex, vec); // new TBlock(this, vec);
            }
            // console.log(globalThis.dfgdfg)
        })()
    }

    *[Symbol.iterator]() {
        for(let index = 0; index < this.count; index++) {
            // let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
            let x = index % CHUNK_SIZE_X;
            let y = index / (CHUNK_SIZE_X * CHUNK_SIZE_Z) | 0;
            let z = ((index) % (CHUNK_SIZE_X * CHUNK_SIZE_Z) - x) / CHUNK_SIZE_X;
            let vec = new Vector(x, y, z);
            yield new TBlock(this, vec);
        }
    }

    delete(vec) {
        let block           = this.get(vec);
        block.id            = null;
        block.power         = 0;
        block.rotate        = null;
        block.entity_id     = null;
        block.texture       = null;
        block.extra_data    = null;
        block.vertices      = null;
        block.falling       = null;
        block.shapes        = null;
        block.position      = null;
    }

    /**
     * Get or fill block by it pos
     * @param {Vector} vec 
     * @param {TBlock} block 
     * @returns 
     */
    get(vec, block = null) {
        return block 
            ? block.init(this, vec) 
            : new TBlock(this, vec);
    }

    has(vec) {
        // const index = BLOCK.getIndex(vec);
        const index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * vec.y + (vec.z * CHUNK_SIZE_X) + vec.x;
        return this.id[index] > 0;
    }

}
