import {Vector, VectorCollector} from "./helpers.js";
import {TBlock} from "./typed_blocks.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_SIZE, getChunkAddr} from "./chunk.js";


// VectorCollector...
export class VectorCollector1D {
    constructor(dims, list) {
        this.dims = dims;
        this.sy = dims.x * dims.z;
        this.sz = dims.x;
        this.clear(list);
    }

    clear(list) {
        this.list = list ? list : new Map();
        this.size = this.list.size;
    }

    set(vec, value) {
        const {sy, sz, list} = this;
        let ind = vec.x + vec.y * sy + vec.z * sz;
        if (typeof value === 'function') {
            value = value(vec);
        }
        list.set(ind, value);
        if (this.size < list.size) {
            this.size = list.size;
            return true;
        }
        return false;
    }

    add(vec, value) {
        const {sy, sz, list} = this;
        let ind = vec.x + vec.y * sy + vec.z * sz;
        if(!list.get(ind)) {
            if (typeof value === 'function') {
                value = value(vec);
            }
            list.set(ind, value);
        }
        this.size = list.size;
        return list.get(ind);
    }

    delete(vec) {
        const {sy, sz, list} = this;
        let ind = vec.x + vec.y * sy + vec.z * sz;
        if(list.delete(ind)) {
            this.size = list.size;
            return true;
        }
        return false;
    }

    has(vec) {
        const {sy, sz, list} = this;
        let ind = vec.x + vec.y * sy + vec.z * sz;
        return list.has(ind) || false;
    }

    get(vec) {
        const {sy, sz, list} = this;
        let ind = vec.x + vec.y * sy + vec.z * sz;
        return list.get(ind) || null;
    }
}

export class TypedBlocks2 {

    #neightbours_chunks;

    constructor(coord, chunkSize, block_count = CHUNK_SIZE) {
        this.addr       = getChunkAddr(coord);
        this.coord      = coord;
        this.chunkSize = chunkSize;
        this.count      = block_count;
        this.id         = new Uint16Array(this.count);
        this.power      = new VectorCollector1D(chunkSize);
        this.rotate     = new VectorCollector1D(chunkSize);
        this.entity_id  = new VectorCollector1D(chunkSize);
        this.texture    = new VectorCollector1D(chunkSize);
        this.extra_data = new VectorCollector1D(chunkSize);
        this.vertices   = new VectorCollector1D(chunkSize);
        this.falling    = new VectorCollector1D(chunkSize);
        //
        this.shapes     = new VectorCollector1D(chunkSize);
        this.metadata   = new VectorCollector1D(chunkSize);
        this.position   = new VectorCollector1D(chunkSize);
        this.non_zero   = 0;

        this.dataChunk = {
            cx: 1,
            cy: chunkSize.x * chunkSize.z,
            cz: chunkSize.x,
            cw: 0,
            portals: null,
        }
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
        const {chunkSize} = this;
        this.id         = state.id; // new Uint16Array(state.id);
        this.power      = new VectorCollector1D(chunkSize, state.power.list);
        this.rotate     = new VectorCollector1D(chunkSize, state.rotate.list);
        this.entity_id  = new VectorCollector1D(chunkSize, state.entity_id.list);
        this.texture    = new VectorCollector1D(chunkSize, state.texture.list);
        this.extra_data = new VectorCollector1D(chunkSize, state.extra_data.list);
        this.vertices   = new VectorCollector1D(chunkSize, state.vertices.list);
        this.shapes     = new VectorCollector1D(chunkSize, state.shapes.list);
        this.falling    = new VectorCollector1D(chunkSize, state.falling.list);
        if(refresh_non_zero) {
            this.refreshNonZero();
        }
    }

    saveState() {
        return this;
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
        //TODO: are we sure that vec wont be modified?
        const { cx, cy, cz } = this;
        const index = cy * vec.y + cz * vec.z + cx * vec.x;
        return block
            ? block.init(this, vec, index)
            : new TBlock(this, vec, index);
    }

    has(vec) {
        const { cx, cy, cz } = this;
        const index = cy * vec.y + cz * vec.z + cx * vec.x;
        return this.id[index] > 0;
    }

    static _tmp = new Vector();

    getBlockId(x, y, z) {
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        return this.id[index];
    }

    setBlockRotateExtra(x, y, z, rotate, extra_data) {
        const vec = TypedBlocks2._tmp.set(x, y, z);
        if (rotate !== undefined) {
            this.rotate.set(vec, rotate);
        }
        if (extra_data !== undefined) {
            this.extra_data.set(vec, extra_data);
        }
    }

    setBlockId(x, y, z, id) {
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        this.id[index] = id;
        return 0;
    }
}
