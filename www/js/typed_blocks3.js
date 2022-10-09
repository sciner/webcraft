import { getChunkAddr, Vector } from "./helpers.js";
import { DataChunk } from './core/DataChunk.js';
import { BaseChunk } from './core/BaseChunk.js';
import { AABB } from './core/AABB.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "./chunk_const.js";
import {BLOCK, POWER_NO} from "./blocks.js";
import {calcFluidLevel, getBlockByFluidVal} from "./fluid/FluidBuildVertices.js";
import {FLUID_LEVEL_MASK, FLUID_TYPE_MASK, FLUID_WATER_ID, fluidLightPower} from "./fluid/FluidConst.js";

export function newTypedBlocks(x, y, z) {
    return new TypedBlocks3(x, y, z);
}

export const MASK_VERTEX_MOD = 128;
export const MASK_VERTEX_PACK = 127;

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

    *[Symbol.iterator]() {
        for (let value of this.list.values()) {
            yield value;
        }
    }
}

//
export class TypedBlocks3 {

    constructor(coord, chunkSize) {
        this.addr       = getChunkAddr(coord);
        this.coord      = coord;
        this.chunkSize  = chunkSize;
        this.power      = new VectorCollector1D(chunkSize);
        this.rotate     = new VectorCollector1D(chunkSize);
        this.entity_id  = new VectorCollector1D(chunkSize);
        this.texture    = new VectorCollector1D(chunkSize);
        this.extra_data = new VectorCollector1D(chunkSize);
        this.falling    = new VectorCollector1D(chunkSize);
        //
        this.shapes     = new VectorCollector1D(chunkSize);
        this.metadata   = new VectorCollector1D(chunkSize);
        this.position   = new VectorCollector1D(chunkSize);
        this.non_zero   = 0;

        this.dataChunk = new DataChunk({ size: chunkSize, strideBytes: 2 }).setPos(coord);
        /**
         * store resourcepack_id and number of vertices here
         * @type {Uint8Array}
         */
        this.vertices  = null;
        this.vertExtraLen = null;
        this.id = this.dataChunk.uint16View;
        this.fluid = null;
    }

    ensureVertices() {
        if (!this.vertices) {
            this.vertices = new Uint8Array(2 * this.dataChunk.outerLen);
            this.vertExtraLen = [];
            return true;
        }
        return false;
    }

    //
    getNeightboursChunks(world) {
        const {dataChunk, addr} = this;
        let nc = {};
        for (let i=0;i<dataChunk.portals.length;i++) {
            if (dataChunk.portals[i].volume > 8) {
                const other = dataChunk.portals[i].toRegion.rev.pos;
                if (addr.x < this.addr.x) {
                    nc.nx = other;
                } else
                if (addr.x > this.addr.x) {
                    nc.px = other;
                } else
                if (addr.y < this.addr.y) {
                    nc.ny = other;
                } else
                if (addr.y > this.addr.y) {
                    nc.py = other;
                } else
                if (addr.z < this.addr.z) {
                    nc.nz = other;
                } else
                if (addr.z > this.addr.z) {
                    nc.pz = other;
                }
            }
        }

        return nc;
    }

    // Restore state
    restoreState(state, refresh_non_zero = false) {
        const {chunkSize} = this;

        this.dataChunk.uint16View.set(state.id, 0);
        this.power      = new VectorCollector1D(chunkSize, state.power);
        this.rotate     = new VectorCollector1D(chunkSize, state.rotate);
        this.entity_id  = new VectorCollector1D(chunkSize, state.entity_id);
        this.texture    = new VectorCollector1D(chunkSize, state.texture);
        this.extra_data = new VectorCollector1D(chunkSize, state.extra_data);
        this.shapes     = new VectorCollector1D(chunkSize, state.shapes);
        this.falling    = new VectorCollector1D(chunkSize, state.falling);
        if(refresh_non_zero) {
            this.refreshNonZero();
        }
        if (state.fluid) {
            this.fluid.restoreState(state.fluid);
        }
    }

    saveState() {
        return {
            id: this.dataChunk.uint16View,
            power: this.power.list,
            rotate: this.rotate.list,
            entity_id: this.entity_id.list,
            texture: this.texture.list,
            extra_data: this.extra_data.list,
            shapes: this.shapes.list,
            falling: this.falling.list,
            fluid: this.fluid.saveState(),
        }
    }

    //
    refreshNonZero() {
        this.non_zero = 0;
        const id = this.dataChunk.uint16View;
        const fluid = this.fluid.uint16View;
        const len = id.length;
        for(let i = 0; i < len; i++) {
            if(id[i] !== 0 || fluid[i] !== 0) {
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
        const { cx, cy, cz, cw } = this.dataChunk;
        index = cx * x + cy * y + cz * z + cw;
        const i_up = index + cy;
        const i_down = index - cy;
        const i_north = index + cz;
        const i_south = index - cz;
        const i_east = index + cx;
        const i_west = index - cx;
        const is_filled = this.isFilled(id);
        const is_water = false; // this.isWater(id);
        if(is_filled || is_water) {
            // assume stride16 is 1
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
        const { size, uint16View, cx, cy, cz, cw } = this.dataChunk;
        const contex = b.tb = this;
        return (function* () {
            // if(!globalThis.dfgdfg) globalThis.dfgdfg = 0;
            for (let y = 0; y < size.y; y++)
                for (let z = 0; z < size.z; z++)
                    for (let x = 0; x < size.x; x++) {
                        const index = cx * x + cy * y + cz * z + cw;
                        const id = uint16View[index];
                        if (!id) continue;
                        if (ignore_filled && contex.blockIsClosed(index, id, x, y, z)) {
                            continue;
                        }
                        b.index = index;
                        b.vec.set(x, y, z)
                        yield b;
                    }
            // console.log(globalThis.dfgdfg)
        })()
    }

    *[Symbol.iterator]() {
        const { size } = this.dataChunk;
        const { cx, cy, cz, cw } = this;
        for (let y = 0; y < size.y; y++)
            for (let z = 0; z < size.z; z++)
                for (let x = 0; x < size.x; x++) {
                    const index = cx * x + cy * y + cz * z + cw;
                    let vec = new Vector(x, y, z);
                    yield new TBlock(this, vec, index);
                }
    }

    delete(vec) {
        const block         = this.get(vec);
        block.id            = 0;
        block.power         = 0;
        block.rotate        = null;
        block.entity_id     = null;
        block.texture       = null;
        block.extra_data    = null;
        block.falling       = null;
        block.shapes        = null;
        block.position      = null;

        if (this.vertices) {
            this.vertices[block.index * 2 + 1] = MASK_VERTEX_MOD;
        }
    }

    /**
     * Get or fill block by it pos
     * @param {Vector} vec
     * @param {TBlock} block
     * @returns
     */
    get(vec, block = null) {
        //TODO: are we sure that vec wont be modified?
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * vec.x + cy * vec.y + cz * vec.z + cw;
        return block
            ? block.init(this, vec, index)
            : new TBlock(this, vec, index);
    }

    has(vec) {
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * vec.x + cy * vec.y + cz * vec.z + cw;
        return this.id[index] > 0;
    }

    static _prt = [];

    getNeighbours(tblock, world, cache) {
        const { portals, safeAABB, pos, outerSize } = this.dataChunk;
        const cx = 1, cy = outerSize.x * outerSize.z, cz = outerSize.x;
        const localPos = tblock.vec;
        const wx = localPos.x + pos.x, wy = localPos.y + pos.y, wz = localPos.z + pos.z;

        if (safeAABB.contains(wx, wy, wz)) {
            for (let dir = 0; dir < CC.length; dir++) {
                const p = CC[dir];
                const cb = cache[dir];
                cb.tb = this;
                cb.vec.x = localPos.x + p.x;
                cb.vec.y = localPos.y + p.y;
                cb.vec.z = localPos.z + p.z;
                cb.index = tblock.index + cx * p.x + cy * p.y + cz * p.z;
            }
        } else {
            //TODO: here we need only 6 portals, not potential 26
            let known = TypedBlocks3._prt;
            let pcnt = 0;
            for (let i = 0; i < portals.length; i++) {
                if (portals[i].aabb.contains(wx, wy, wz)) {
                    known[pcnt++] = portals[i];
                }
            }
            for (let dir = 0; dir < CC.length; dir++) {
                const p = CC[dir];
                const cb = cache[dir];

                const nx = wx + p.x;
                const ny = wy + p.y;
                const nz = wz + p.z;

                cb.tb = null;
                for (let i = 0; i < pcnt; i++) {
                    const ndata = known[i].toRegion;
                    if (ndata.aabb.contains(nx, ny, nz)) {
                        cb.tb = ndata.rev.tblocks;
                        cb.vec.x = nx - ndata.pos.x;
                        cb.vec.y = ny - ndata.pos.y;
                        cb.vec.z = nz - ndata.pos.z;
                        cb.index = ndata.indexByWorld(nx, ny, nz);
                        break;
                    }
                }

                if (!cb.tb) {
                    cb.tb = this;
                    cb.vec.x = localPos.x + p.x;
                    cb.vec.y = localPos.y + p.y;
                    cb.vec.z = localPos.z + p.z;
                    cb.index = tblock.index + cx * p.x + cy * p.y + cz * p.z;
                }
            }
            for (let i = 0; i < known.length; i++) {
                known[i] = null;
            }
        }

        const neighbours = new BlockNeighbours();
        for (let dir = 0; dir < CC.length; dir++) {
            const cb = cache[dir];
            neighbours[CC[dir].name] = cb;
            const properties = cb?.properties;
            if(!properties || properties.transparent || properties.fluid) {
                // @нельзя прерывать, потому что нам нужно собрать всех "соседей"
                neighbours.pcnt--;
            }
        }

        return neighbours;
    }

    static _tmp = new Vector();

    getBlockId(x, y, z) {
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        return this.id[index];
    }

    setBlockRotateExtra(x, y, z, rotate, extra_data, entity_id, power) {
        const vec = TypedBlocks3._tmp.set(x, y, z);
        if (rotate !== undefined) {
            this.rotate.set(vec, rotate);
        }
        if (extra_data !== undefined) {
            this.extra_data.set(vec, extra_data);
        }
        if (entity_id !== undefined) {
            this.entity_id.set(vec, entity_id);
        }
        if (power !== undefined) {
            this.power.set(vec, power);
        }
    }

    setBlockId(x, y, z, id) {
        const { cx, cy, cz, cw, portals, pos, safeAABB } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        this.id[index] = id;
        this.fluid.syncBlockProps(index, id, false);

        const wx = x + pos.x;
        const wy = y + pos.y;
        const wz = z + pos.z;
        if (safeAABB.contains(wx, wy, wz)) {
            return 0;
        }
        let pcnt = 0;
        //TODO: use only face-portals
        for (let i = 0; i < portals.length; i++) {
            if (portals[i].aabb.contains(wx, wy, wz)) {
                const other = portals[i].toRegion;
                const ind2 = other.indexByWorld(wx, wy, wz);
                other.uint16View[ind2] = id;
                // TODO: set calculated props
                other.rev.fluid.syncBlockProps(ind2, id, true);
                pcnt++;
            }
        }

        return pcnt;
    }

    static tempAABB = new AABB();
    static tempAABB2 = new AABB();
    static tempVec = new Vector();

    setDirtyBlocks(x, y, z) {
        const { vertices } = this;
        if (!vertices) {
            return;
        }
        const { cx, cy, cz, portals, pos, safeAABB, shiftCoord} = this.dataChunk;
        const wx = x + pos.x;
        const wy = y + pos.y;
        const wz = z + pos.z;

        let cnt = 0;
        const aabb = TypedBlocks3.tempAABB;
        const aabb2 = TypedBlocks3.tempAABB2;
        const vec = TypedBlocks3.tempVec;
        aabb.set(wx - 1, wy - 1, wz - 1, wx + 2, wy + 2, wz + 2);
        aabb2.setIntersect(aabb, this.dataChunk.aabb);
        for (let x = aabb2.x_min; x < aabb2.x_max; x++)
            for (let y = aabb2.y_min; y < aabb2.y_max; y++)
                for (let z = aabb2.z_min; z < aabb2.z_max; z++) {
                    let index2 = cx * x + cy * y + cz * z + shiftCoord;
                    //TODO: what do we have return actually?
                    if (vertices[index2 * 2] !== 0
                        || vertices[index2 * 2 + 1] !== 0) {
                        cnt++;
                    }
                    vertices[index2 * 2 + 1] |= MASK_VERTEX_MOD;
                }
        if (safeAABB.contains(wx, wy, wz)) {
            return 0;
        }
        //TODO: use only face-portals
        for (let i = 0; i < portals.length; i++) {
            if (portals[i].aabb.contains(wx, wy, wz)) {
                const other = portals[i].toRegion;
                const vertices2 = other.rev.tblocks.vertices;
                if (!vertices2) {
                    continue;
                }
                aabb2.setIntersect(other.aabb, aabb);
                for (let x = aabb2.x_min; x < aabb2.x_max; x++)
                    for (let y = aabb2.y_min; y < aabb2.y_max; y++)
                        for (let z = aabb2.z_min; z < aabb2.z_max; z++) {
                            let index2 = other.indexByWorld(x, y, z);
                            if (vertices2[index2 * 2] !== 0
                                || vertices2[index2 * 2 + 1] !== 0) {
                                cnt++;
                            }
                            vertices2[index2 * 2 + 1] |= MASK_VERTEX_MOD;
                        }
            }
        }

        return cnt;
    }
}

export class DataWorld {
    constructor(chunkManager) {
        const INF = 1000000000;
        this.chunkManager = chunkManager;
        this.base = new BaseChunk({size: new Vector(INF, INF, INF)})
            .setPos(new Vector(-INF / 2, -INF / 2, -INF / 2));
    }

    addChunk(chunk) {
        if (!chunk) {
            return;
        }
        if (chunk.dataChunk) {
            console.warn('double-adding chunk!');
            debugger;
            return;
        }
        chunk.dataChunk = chunk.tblocks.dataChunk;
        chunk.dataChunk.rev = chunk;
        this.base.addSub(chunk.dataChunk);
        if (this.chunkManager.fluidWorld) {
            this.chunkManager.fluidWorld.addChunk(chunk);
        }
    }

    removeChunk(chunk) {
        if (!chunk || !chunk.dataChunk || !chunk.dataChunk.portals) {
            return;
        }
        this.base.removeSub(chunk.dataChunk);
        if (this.chunkManager.fluidWorld) {
            this.chunkManager.fluidWorld.removeChunk(chunk);
        }
    }

    /**
     * store blocks of other chunks that are seen in this chunk
     */
    syncOuter(chunk) {
        if (!chunk || !chunk.dataChunk.portals) {
            return;
        }

        const fluid = chunk.fluid.uint16View;

        const { portals, aabb, uint16View, cx, cy, cz } = chunk.dataChunk;
        const cw = chunk.dataChunk.shiftCoord;
        const tempAABB = new AABB();

        chunk.fluid.syncAllProps();
        for (let i = 0; i < portals.length; i++) {
            const portal = portals[i];
            const other = portals[i].toRegion;
            const otherView = other.uint16View;
            const otherFluid = other.rev.fluid.uint16View;

            const cx2 = other.cx;
            const cy2 = other.cy;
            const cz2 = other.cz;
            const cw2 = other.shiftCoord;

            let otherDirtyFluid = false;

            tempAABB.setIntersect(aabb, portal.aabb);
            for (let y = tempAABB.y_min; y < tempAABB.y_max; y++)
                for (let z = tempAABB.z_min; z < tempAABB.z_max; z++)
                    for (let x = tempAABB.x_min; x < tempAABB.x_max; x++) {
                        const ind = x * cx + y * cy + z * cz + cw;
                        const ind2 = x * cx2 + y * cy2 + z * cz2 + cw2;
                        otherView[ind2] = uint16View[ind];
                        if (otherFluid[ind2] !== fluid[ind]) {
                            otherFluid[ind2] = fluid[ind];
                            otherDirtyFluid = true;
                        }
                    }
            tempAABB.setIntersect(other.aabb, portal.aabb);
            for (let y = tempAABB.y_min; y < tempAABB.y_max; y++)
                for (let z = tempAABB.z_min; z < tempAABB.z_max; z++)
                    for (let x = tempAABB.x_min; x < tempAABB.x_max; x++) {
                        const ind = x * cx + y * cy + z * cz + cw;
                        const ind2 = x * cx2 + y * cy2 + z * cz2 + cw2;
                        uint16View[ind] = otherView[ind2];
                        fluid[ind] = otherFluid[ind2];
                    }
            if (otherDirtyFluid) {
                other.rev.fluid.markDirtyMesh();
            }
        }
    }

    /**
     * sets block here and in other chunks
     *
     * @param chunk
     * @param x
     * @param y
     * @param z
     * @param id
     * @returns {number} of portals to other chunks
     */
    setChunkBlock(chunk, x, y, z, id) {
        return chunk.dataChunk.setBlockId(x, y, z, id);
    }
}

export class TBlock {

    constructor(tb, vec, index) {
        this.init(tb, vec, index);
    }

    init(tb = this.tb, vec = this.vec, index = undefined) {
        //TODO try remove third param
        this.tb = tb;
        this.vec = vec;
        this.index = index || (this.vec ? BLOCK.getIndex(this.vec) : NaN);
        return this;
    }

    get posworld() {
        return this.vec.add(this.tb.coord);
    }

    get has_oxygen() {
        if(!this.material.has_oxygen) {
            return false;
        }
        if(this.id == 0 && this.fluid > 0) {
            return false;
        }
        return true;
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
        this.tb.setBlockId(this.vec.x, this.vec.y, this.vec.z, value);
    }

    get lightSource() {
        let res = 0;
        const mat = BLOCK.BLOCK_BY_ID[this.id]
        if (mat) {
            res = mat.light_power_number;
        }
        const fluidVal = this.tb.fluid.getValueByInd(this.index);
        if (fluidVal > 0) {
            res |= fluidLightPower(fluidVal);
        }
        return res;
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
        return BLOCK.BLOCK_BY_ID[this.id] || null;
    }

    // material
    get material() {
        return BLOCK.BLOCK_BY_ID[this.id] || null;
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
        return this.material;
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

    get fluid() {
        return this.tb.fluid.getValueByInd(this.index);
    }

    set fluid(value) {
        this.tb.fluid.setValue(this.vec.x, this.vec.y, this.vec.z, value);
    }

    get fluidSource() {
        const fs = this.tb.fluid.getValueByInd(this.index);
        if (fs > 0 && (fs & FLUID_LEVEL_MASK) === 0) {
            return fs;
        }
        return 0;
    }

    get isWater() {
        return (this.tb.fluid.getValueByInd(this.index) & FLUID_TYPE_MASK) === FLUID_WATER_ID;
    }

    getFluidLevel(worldX, worldZ) {
        let relX = worldX  - this.vec.x - this.tb.coord.x;
        let relZ = worldZ  - this.vec.z - this.tb.coord.z;
        if (relX < 0) relX = 0;
        if (relX > 1) relX = 1;
        if (relZ < 0) relZ = 0;
        if (relZ > 1) relZ = 1;
        return calcFluidLevel(this.tb.fluid, this.index, relX, relZ) + this.vec.y + this.tb.coord.y;
    }

    getFluidBlockMaterial() {
        return getBlockByFluidVal(this.fluid);
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
        return mat.tags && mat.tags.includes(tag);
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
        if (this.tb.getNeighbours) {
            return this.tb.getNeighbours(this, world, cache);
        }

        const neighbours = new BlockNeighbours();
        const nc = this.tb.getNeightboursChunks(world);
        const pos = this.vec;
        let chunk;
        let is_water_count = 0;
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

    get is_fluid() {
        return this.id == 0 && this.fluid > 0;
    }

}