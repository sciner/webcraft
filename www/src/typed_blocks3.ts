import { getChunkAddr, Vector, ObjectHelpers, chunkAddrToCoord } from "./helpers.js";
import { DataChunk } from './core/DataChunk.js';
import { BaseChunk } from './core/BaseChunk.js';
import { AABB } from './core/AABB.js';
import {CHUNK_SIZE_X_M1, CHUNK_SIZE_Y_M1, CHUNK_SIZE_Z_M1, CHUNK_CX, CHUNK_CY, CHUNK_CZ, CHUNK_CW} from "./chunk_const.js";
import {BLOCK, POWER_NO} from "./blocks.js";
import {calcFluidLevel, getBlockByFluidVal} from "./fluid/FluidBuildVertices.js";
import {FLUID_LEVEL_MASK, FLUID_TYPE_MASK, FLUID_WATER_ID, fluidLightPower} from "./fluid/FluidConst.js";
import type { FluidChunk } from "./fluid/FluidChunk.js";
import type { ChunkLight } from "./light/ChunkLight.js";
import type { AnyChunk } from "./helpers.js";

export function newTypedBlocks(coord : Vector, chunkSize: Vector) {
    return new TypedBlocks3(coord, chunkSize);
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
    [key: string]: any;

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

const tmp_BlockAccessor_Vector = new Vector();

// VectorCollector...
export class VectorCollector1D {

    dims: IVector
    sy: number
    sz: number
    list: Map<number, any>
    size: number

    constructor(dims: IVector, list?: Map<number, any>) {
        this.dims = dims;
        this.sy = dims.x * dims.z;
        this.sz = dims.x;
        this.clear(list);
    }

    clear(list?: Map<number, any>) {
        this.list = list ?? new Map();
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

    addr            : Vector = null
    coord           : Vector = null
    chunkSize       : Vector = null
    non_zero        : int = 0
    vertExtraLen    : any[] = null
    fluid           : FluidChunk = null
    light           : ChunkLight = null
    dataChunk       : any | DataChunk = null
    vertices        : Uint8Array = null
    lightData       : Uint8Array = null

    tblocks?        : TypedBlocks3 = null
    id              : Uint16Array = null
    power           : VectorCollector1D = null
    rotate          : VectorCollector1D = null
    entity_id       : VectorCollector1D = null
    texture         : VectorCollector1D = null
    extra_data      : VectorCollector1D = null
    falling         : VectorCollector1D = null
    shapes          : VectorCollector1D = null
    metadata        : VectorCollector1D = null
    position        : VectorCollector1D = null
    chunk           : AnyChunk

    constructor(coord : Vector, chunkSize: Vector) {
        this.addr       = Vector.toChunkAddr(coord);
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
        //
        this.dataChunk = new DataChunk({ size: chunkSize, strideBytes: 2 }).setPos(coord);
        /**
         * store resourcepack_id and number of vertices here
         * @type {Uint8Array}
         */
        this.vertices  = null;
        this.id = this.dataChunk.uint16View;
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
        const nc = {} as {nx : any, px: any, ny : any, py: any, nz : any, pz: any};
        for (let i = 0; i < dataChunk.portals.length; i++) {
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
        const is_solid = BLOCK.isSolidID(id);
        const is_water = false; // this.isWater(id);
        if(is_solid || is_water) {
            // assume stride16 is 1
            const id_up = this.id[i_up];
            const id_down = this.id[i_down];
            const id_north = this.id[i_north];
            const id_south = this.id[i_south];
            const id_west = this.id[i_west];
            const id_east = this.id[i_east];
            if(BLOCK.isSolidID(id_up) && BLOCK.isSolidID(id_down) && BLOCK.isSolidID(id_south) &&
                BLOCK.isSolidID(id_north) && BLOCK.isSolidID(id_west) && BLOCK.isSolidID(id_east)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Return saolid neighbours count
     *
     * @param {int} x
     * @param {int} y
     * @param {int} z
     *
     * @returns {int}
     */
    blockSolidNeighboursCount(x, y, z) {
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        const i_up = index + cy;
        const i_down = index - cy;
        const i_north = index + cz;
        const i_south = index - cz;
        const i_east = index + cx;
        const i_west = index - cx;
        let resp = 0;
        if(this.id[i_up]) resp++
        if(this.id[i_down]) resp++
        if(this.id[i_north]) resp++
        if(this.id[i_south]) resp++
        if(this.id[i_west]) resp++
        if(this.id[i_east]) resp++
        return resp;
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
        const { size, cx, cy, cz, cw } = this.dataChunk;
        for (let y = 0; y < size.y; y++)
            for (let z = 0; z < size.z; z++)
                for (let x = 0; x < size.x; x++) {
                    const index = cx * x + cy * y + cz * z + cw;
                    let vec = new Vector(x, y, z);
                    yield new TBlock(this, vec, index);
                }
    }

    delete(vec : Vector) {
        const block         = this.get(vec, tmpTBlock_delete);
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
     * It deletes only the extra properties that are used by the generator.
     * It doesn't change the block id.
     * It's much faster than {@link delete}
     */
    deleteExtraInGenerator(vec : IVector) : void {
        this.rotate.delete(vec)
        this.extra_data.delete(vec)
        this.entity_id.delete(vec)
        this.power.delete(vec)
    }

    /**
     * Get or fill block by it pos
     * @param {Vector} vec
     * @param {TBlock} block
     * @returns
     */
    get(vec : Vector, block?: TBlock | null) : TBlock {
        //TODO: are we sure that vec wont be modified?
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * vec.x + cy * vec.y + cz * vec.z + cw;
        return block
            ? block.init(this, vec, index)
            : new TBlock(this, vec, index);
    }

    getMaterial(vec) {
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * vec.x + cy * vec.y + cz * vec.z + cw;
        return BLOCK.BLOCK_BY_ID[this.id[index]] || null;
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

    setBlockRotateExtra(x: number, y: number, z: number, rotate?: IVector | null, extra_data?: object | null, entity_id?: string | null, power?: number | null) {
        const vec = TypedBlocks3._tmp.set(x, y, z);
        if (rotate !== undefined) {
            if (rotate != null) {
                this.rotate.set(vec, rotate);
            } else {
                this.rotate.delete(vec);
            }
        }
        if (extra_data !== undefined) {
            if (extra_data != null) {
                this.extra_data.set(vec, extra_data);
            } else {
                this.extra_data.delete(vec);
            }
        }
        if (entity_id !== undefined) {
            if (entity_id != null) {
                this.entity_id.set(vec, entity_id);
            } else {
                this.entity_id.delete(vec);
            }
        }
        if (power !== undefined) {
            if (power != null) {
                this.power.set(vec, power);
            } else {
                this.power.delete(vec);
            }
        }
    }

    setBlockId(x : int, y : int, z : int, id : int) {
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
        const chunk = this.dataChunk.rev;
        const { buildQueue } = chunk.chunkManager.world;

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
        if (buildQueue && !chunk.inQueue) {
            buildQueue.push(chunk);
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
                            if (buildQueue && !other.rev.inQueue) {
                                buildQueue.push(other.rev);
                            }
                        }
            }
        }

        return cnt;
    }

    setDirtyAABB(aabb) {
        const { cx, cy, cz, shiftCoord} = this.dataChunk;
        const {vertices} = this;
        for (let x = aabb.x_min; x < aabb.x_max; x++)
            for (let y = aabb.y_min; y < aabb.y_max; y++)
                for (let z = aabb.z_min; z < aabb.z_max; z++) {
                    let index2 = cx * x + cy * y + cz * z + shiftCoord;
                    vertices[index2 * 2 + 1] |= MASK_VERTEX_MOD;
                }
    }

    makeBedrockEdge() {
        const {id} = this;
        const {outerSize, cx, cy, cz} = this.dataChunk;
        let rest = (outerSize.z - 1) * cz;
        for (let x = 0; x < outerSize.x; x++)
            for (let y = 0; y < outerSize.y; y++) {
                let ind = x * cx + y * cy;
                id[ind] = 1;
                id[ind + rest] = 1;
            }
        rest = (outerSize.y - 1) * cy;
        for (let x = 0; x < outerSize.x; x++)
            for (let z = 0; z < outerSize.z; z++) {
                let ind = x * cx + z * cz;
                id[ind] = 1;
                id[ind + rest] = 1;
            }
        rest = (outerSize.x - 1) * cx;
        for (let z = 0; z < outerSize.z; z++)
            for (let y = 0; y < outerSize.y; y++) {
                let ind = z * cz + y * cy;
                id[ind] = 1;
                id[ind + rest] = 1;
            }
    }

    makeBedrockFacet(bounds) {
        const {id} = this;
        const {cx, cy, cz, shiftCoord, aabb, outerAABB} = this.dataChunk;
        for (let x = bounds.x_min; x < bounds.x_max; x++)
            for (let y = bounds.y_min; y < bounds.y_max; y++)
                for (let z = bounds.z_min; z < bounds.z_max; z++) {
                    let index = cx * x + cy * y + cz * z + shiftCoord;
                    id[index] = 1;
                }
    }

    getInterpolatedLightValue(localVec) {
        let totalW = 0, totalCave = 0, totalDay = 0;

        const {lightData, id} = this;
        if (!lightData) {
            return 0;
        }
        const {cx, cy, cz, cw} = this.dataChunk;

        let x1 = Math.floor(localVec.x), y1 = Math.floor(localVec.y), z1 = Math.floor(localVec.z);
        let dx1 = localVec.x - x1, dy1 = localVec.y - y1, dz1 = localVec.z - z1;
        let base = x1 * cx + y1 * cy + z1 * cz + cw;
        for (let x0 = 0; x0 < 2; x0++)
            for (let y0 = 0; y0 < 2; y0++)
                for (let z0 = 0; z0 < 2; z0++) {
                    const index = base + x0 * cx + y0 * cy + z0 * cz;
                    const weight = (1 - x0 + (2 * x0 - 1) * dx1)
                        * (1 - y0 + (2 * y0 - 1) * dy1)
                        * (1 - z0 + (2 * z0 - 1) * dz1);
                    const blockId = id[index];
                    const block_material = BLOCK.BLOCK_BY_ID[blockId]
                    let p = 0;
                    if (block_material) {
                        p = block_material.light_power_number;
                    }

                    let cave = lightData[index] & 0x0f, day = lightData[index] >> 4;
                    cave *= 255 / 15;
                    day *= 255 / 15;
                    day = 255 - day;
                    if ((p & 96) < 96) {
                        totalW += weight;
                        totalCave += cave * weight;
                        totalDay += day * weight;
                    }
                }
        if (totalW > 0) {
            totalCave = Math.round(totalCave / totalW);
            totalDay = Math.round(totalDay / totalW);
            return totalCave + (totalDay << 8);
        } else {
            //ZERO
            return 0 + (255 << 8);
        }
    }
}

export class DataWorld {
    [key: string]: any;
    constructor(chunkManager) {
        const INF = 1000000000;
        this.chunkManager = chunkManager;
        this.base = new BaseChunk({size: new Vector(INF, INF, INF)})
            .setPos(new Vector(-INF / 2, -INF / 2, -INF / 2));
    }

    addChunk(chunk, isRestore) {
        if (!chunk) {
            return;
        }
        if (chunk.dataChunk
            || isRestore && chunk.tblocks.dataChunk.portals.length > 0) {
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
        const {portals, aabb} = chunk.dataChunk;
        const tempRect = new AABB();
        for (let i = 0; i < portals.length; i++) {
            tempRect.setIntersect(aabb, portals[i].aabb);
            portals[i].toRegion.rev.tblocks.makeBedrockFacet(tempRect);
        }
        this.base.removeSub(chunk.dataChunk);
        chunk.dataChunk = null;
        if (this.chunkManager.fluidWorld) {
            this.chunkManager.fluidWorld.removeChunk(chunk);
        }
    }

    //TODO: optimize this method!
    removeChunks(chunkArray) {
        for (let i = 0; i < chunkArray.length; i++) {
            this.removeChunk(chunkArray[i]);
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
            const otherChunk = other.rev;
            const otherFluid = otherChunk.fluid.uint16View;

            const cx2 = other.cx;
            const cy2 = other.cy;
            const cz2 = other.cz;
            const cw2 = other.shiftCoord;

            let otherDirtyFluid = false;
            let otherDirtyMesh = 0;

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
                        const val = otherView[ind2];
                        if (val !== 0) {
                            otherDirtyMesh |= 2;
                        }
                        uint16View[ind] = val;
                        fluid[ind] = otherFluid[ind2];
                    }
            if (otherDirtyFluid) {
                other.rev.fluid.markDirtyMesh();
            }
            if (otherDirtyMesh === 2) {
                const tb = otherChunk.tblocks;
                if (tb.vertices) {
                    tb.setDirtyAABB(tempAABB);
                    if (!otherChunk.inQueue) {
                        chunk.chunkManager.world.buildQueue.push(otherChunk);
                    }
                }
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

    tb: TypedBlocks3
    vec: Vector
    index: number

    constructor(tb? : TypedBlocks3, vec? : Vector, index? : number) {
        this.init(tb, vec, index);
    }

    init(tb: TypedBlocks3 = this.tb, vec: Vector = this.vec, index?: number) {
        //TODO try remove third param
        this.tb = tb;
        this.vec = vec;
        this.index = index ?? NaN;

        // Old code that used incorrect BLOCK.getIndex
        // this.index = index || (this.vec ? BLOCK.getIndex(this.vec) : NaN);

        return this;
    }

    get chunk(): AnyChunk {
        return this.tb.chunk;
    }

    initFrom(block: TBlock) {
        this.tb = block.tb;
        this.vec = block.vec;
        this.index = block.index;
        return this;
    }

    // Clones essential data as POJO.
    // The result can be used in WorldAction.addBlocks() to create/modify the same block
    clonePOJO() {
        let res : IBlockItem = { id: this.id };
        if (res.id) {  // AIR blocks are very common, they don't have properties
            if (BLOCK.BLOCK_BY_ID[res.id]?.can_rotate && this.rotate) {
                res.rotate = { ...this.rotate };
            }
            let v = this.extra_data; // avoid accessing slow this.extra_data twice
            if (v) {
                res.extra_data = ObjectHelpers.deepClone(v);
            }
            v = this.entity_id
            if (v) {
                res.entity_id = v;
            }
            // Power in blocks is never used and not fully supported, e.g. it's lost in the old DBWorld.updateChunks.
            // TODO either use and fully support, or remove it.
            v = this.power;
            if (v) {
                res.power = v;
            }
        }
        return res;
    }

    get posworld() : Vector {
        return this.vec.add(this.tb.coord);
    }

    get chunk_addr() {
        return this.tb.addr;
    }

    get has_oxygen() : boolean {
        if(!this.material.has_oxygen) {
            return false;
        }
        if(this.id == 0 && this.fluid > 0) {
            return false;
        }
        return true;
    }

    //
    get pos() : Vector {
        return this.vec;
    }

    //
    get id() : int {
        return this.tb.id[this.index];
    }
    set id(value: int) {
        // let cu = this.tb.id[this.index];
        // this.tb.non_zero += (!cu && value) ? 1 : ((cu && !value) ? -1 : 0);
        this.tb.setBlockId(this.vec.x, this.vec.y, this.vec.z, value);
    }

    get lightSource() {
        let res = 0;
        const mat = BLOCK.BLOCK_BY_ID[this.id]
        if (mat) {
            if(mat.is_dynamic_light) {
                return (this?.extra_data?.active || this?.extra_data?.lava) ? mat.light_power_number : 0;
            }
            res = mat.light_power_number;
        }
        const fluidVal = this.tb.fluid.getValueByInd(this.index);
        if (fluidVal > 0) {
            res |= fluidLightPower(fluidVal);
        }
        return res;
    }

    // get lightData() {
    //     return this.light?.lightData;
    // }

    /**
     * uin16, low bits are cave, high bits are day
     */
    get lightValue() {
        const {lightData} = this.tb;
        const {index} = this;
        if (!lightData) {
            return 0;
        }
        let cave = lightData[index] & 0x0f, day = lightData[index] >> 4;
        day = 15 - day;
        return Math.round(cave * 255 / 15)
            + (Math.round(day * 255 / 15) << 8);
    }

    //
    get power() {
        let resp = this.tb.power.get(this.vec);
        if(resp === null) resp = POWER_NO;
        return resp;
    }
    set power(value) {
        if(value) {
            this.tb.power.set(this.vec, value)
            return
        }
        this.tb.power.delete(this.vec);
    }

    //
    get rotate() {
        return this.tb.rotate.get(this.vec);
    }
    set rotate(value) {
        if(value) {
            this.tb.rotate.set(this.vec, value)
            return
        }
        this.tb.rotate.delete(this.vec);
    }

    // entity_id
    get entity_id() {
        return this.tb.entity_id.get(this.vec);
    }
    set entity_id(value) {
        if(value) {
            this.tb.entity_id.set(this.vec, value)
            return
        }
        this.tb.entity_id.delete(this.vec);
    }

    // texture
    get texture() {
        return this.tb.texture.get(this.vec);
    }
    set texture(value) {
        if(value) {
            this.tb.texture.set(this.vec, value)
            return
        }
        this.tb.texture.delete(this.vec);
    }

    // extra_data
    get extra_data() {
        return this.tb.extra_data.get(this.vec);
    }
    set extra_data(value) {
        if(value) {
            this.tb.extra_data.set(this.vec, value)
            return
        }
        this.tb.extra_data.delete(this.vec);
    }

    // falling
    get falling() {
        return this.tb.falling.get(this.vec);
    }
    set falling(value) {
        if(value) {
            this.tb.falling.set(this.vec, value)
            return
        }
        this.tb.falling.delete(this.vec);
    }

    // // vertices
    // get vertices() {
    //     return this.tb.vertices.get(this.vec);
    // }
    // set vertices(value) {
    //     if(value !== null) {
    //         this.tb.vertices.set(this.vec, value)
    //         return
    //     }
    //     this.tb.vertices.delete(this.vec);
    // }

    // shapes
    get shapes() {
        return this.tb.shapes.get(this.vec);
    }
    set shapes(value) {
        if(value) {
            this.tb.shapes.set(this.vec, value)
            return
        }
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
        if(value) {
            this.tb.position.set(this.vec, value)
            return
        }
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
        const mat = this.material;
        return mat?.tags?.includes(tag) ?? false
    }

    convertToDBItem() {
        return BLOCK.convertBlockToDBItem(this);
    }

    /**
     * Возвращает всех 6-х соседей блока
     * @param {Vector} pos
     * @param {Array} cache
     * @returns
     */
    getNeighbours(world, cache) {
        return this.tb.getNeighbours(this, world, cache);
    }

    get is_fluid() {
        return this.id == 0 && this.fluid > 0;
    }

    copyPropsFromPOJO(obj) {
        this.id = obj.id;
        this.extra_data = obj?.extra_data || null;
        this.entity_id = obj?.entity_id || null;
        this.power = obj?.power || null;
        this.rotate = obj?.rotate || null;
    }

    /**
     * @param { boolean} top
     */
    canPlaceOnTopOrBottom(top = true) {
        if(this.id < 1) return false
        const mat = this.material
        if(mat.is_solid || ['fence', 'beacon'].includes(mat.style_name)) return true
        const extra_data = this.extra_data
        const point = this.extra_data?.point
        if(point && (top ? point.y >= .5 : point.y < .5)) {
            if(mat.tags.includes('trapdoor') && extra_data?.opened) {
                return false
            }
            return true
        }
        //
        if(mat.tags.includes('rotate_by_pos_n_6')) {
            return this.rotate.y != 0
        }
        return false
    }

}

// It's declared here because it ca'be be declared befpre TBlock
const tmpTBlock_delete = new TBlock()

/**
 * A class that provides access to the world blocks in the same area
 * on average as fast as the chunk does to its own blocks.
 *
 * It caches the current chunk, so its instances can't be stored and reused
 * for any prolonged time; it must be re-created, or reset by calling init().
 */
export class BlockAccessor {
    [key: string]: any;

    /**
     * @param {World} world
     * @param {Vector, TBlock or BlockAccessor} initial - optional. Some point near the area
     *   where the class will be used. If it's provided, it slightly speeds up initialization.
     *   Passing {@link TBlock} or {@link BlockAccessor} is preferable.
     */
    constructor(world, initial = null) {
        this.chunkManager = world.chunkManager || world.chunks;
        if (initial instanceof BlockAccessor) {
            this._tmpTbCoord = initial._tmpTbCoord.clone();
            this._vec = initial._vec.clone();
            this._tmpTBlock = new TBlock(initial._tmpTBlock._tb, this._vec, initial._tmpTBlock.index);
            this._tbCoord = initial._tbCoord ? this._tmpTbCoord : null;
            this.tblockOrNull = initial.tblockOrNull ? this._tmpTBlock : null;
        } else {
            this._tmpTbCoord = new Vector(); // used for this._tbCoord when this._tb is absent
            if (initial instanceof TBlock) {
                this._vec = initial.vec.clone();
                this._tmpTBlock = new TBlock(initial.tb, this._vec, initial.index);
                this._tbCoord = initial.tb.coord; // TypedBlocks3.coord taht is present even if _tb == null
                this.tblockOrNull = this._tmpTBlock; // either this._tmpTBlock or null
            } else {
                this._vec = new Vector(); // relative to this._tbCoord
                this._tmpTBlock = new TBlock(null, this._vec, 1);
                if (initial) { // assume it to be a Vector-like object
                    this._rebase(initial.x, initial.y, initial.z);
                } else {
                    this._rebase(0, 0, 0);
                }
            }
        }
    }

    /**
     * Allows a persistent refernce to the class to be used again.
     * It solves the problem of the remembered chunk being unloaded.
     *
     * @param {Vector, TBlock or BlockAccessor} initial - optional. Some point near the area
     *   where the class will be used. If it's provided, it slightly speeds up initialization.
     *   Passing {@link TBlock} or {@link BlockAccessor} is preferable.
     */
    init(initial = null) {
        if (initial instanceof BlockAccessor) {
            this._tmpTbCoord.copyFrom(initial._tmpTbCoord);
            this._vec.copyFrom(initial._vec);
            this._tmpTBlock.tb = initial._tb;
            this._tbCoord = initial._tbCoord ? this._tmpTbCoord : null;
            this.tblockOrNull = initial.tblockOrNull ? this._tmpTBlock : null;
        } else if (initial instanceof TBlock) {
            this._vec.copyFrom(initial.vec);
            this._tmpTBlock.tb = initial.tb;
            this._tbCoord = initial.tb.coord;
            this.tblockOrNull = this._tmpTBlock;
        } else if (initial) { // assume it to be a Vector-like object
            this._rebase(initial.x, initial.y, initial.z);
        } else {
            this._rebase(0, 0, 0);
        }
    }

    /**
     * @returns { int } world coordinate X of the current point.
     */
    get x() {
        return this._tbCoord.x + this._vec.x;
    }

    get y() {
        return this._tbCoord.y + this._vec.y;
    }

    get z() {
        return this._tbCoord.z + this._vec.z;
    }

    /**
     * @returns {Vector} a clone of the current world position.
     */
    posClone() {
        return this._vec.clone().addSelf(this._tbCoord);
    }

    /**
     * Sets the world coordinat X of the current position.
     * @param { int } x
     */
    set x(x) {
        const rx = x - this._tbCoord.x;
        if ((rx | CHUNK_SIZE_X_M1 - rx) >= 0) { // if (rx >= 0 && rx <= CHUNK_SIZE_X_M1)
            this._tmpTBlock.index += CHUNK_CX * (rx - this._vec.x);
            this._vec.x = rx;
            return;
        }
        this._rebase(x, this.y, this.z);
    }

    set y(y) {
        const ry = y - this._tbCoord.y;
        if ((ry | CHUNK_SIZE_Y_M1 - ry) >= 0) { // if (ry >= 0 && ry <= CHUNK_SIZE_Y_M1)
            this._tmpTBlock.index += CHUNK_CY * (ry - this._vec.y);
            this._vec.y = ry;
            return;
        }
        this._rebase(this.x, y, this.z);
    }

    set z(z) {
        const rz = z - this._tbCoord.z;
        if ((rz | CHUNK_SIZE_Z_M1 - rz) >= 0) { // if (rz >= 0 && rz <= CHUNK_SIZE_Z_M1)
            this._tmpTBlock.index += CHUNK_CZ * (rz - this._vec.z);
            this._vec.z = rz;
            return;
        }
        this._rebase(this.x, this.y, z);
    }

    /**
     * Sets the current world position.
     * @param { int } x
     * @param { int } y
     * @param { int } z
     * @returns {BlockAccessor} this
     */
    setXYZ(x, y, z) {
        let c = this.tblocksCoord;
        if (c !== null) {
            // x and y are more likely to be outside the range, so check them together and first
            const rx = x - this._tbCoord.x;
            const rz = z - this._tbCoord.z;
            if ((rx | rz | CHUNK_SIZE_X_M1 - rx | CHUNK_SIZE_Z_M1 - rz) >= 0) {
                const ry = y - this._tbCoord.y;
                if ((ry | CHUNK_SIZE_Y_M1 - ry) >= 0) {
                    this._setRelPos(rx, ry, rz);
                    return this;
                }
            }
        }
        this._rebase(x, y, z);
        return this;
    }

    /**
     * Sets the current world position.
     * @param {Vector} vec
     * @returns {BlockAccessor} this
     */
    setVec(vec) {
        return this.setXYZ(vec.x, vec.y, vec.z);
    }

    /**
     * Adds to the coordinates of the current world position.
     * @param { int } dx
     * @param { int } dy
     * @param { int } dz
     * @returns {BlockAccessor} this
     */
    addXYZ(dx, dy, dz) {
        return this.setXYZ(this.x + dx, this.y + dy, this.z + dz);
    }

    /**
     * @returns { int } id of the current block, or null if the chunk is not generated.
     */
    get idOrNull() {
        return this.tblockOrNull?.id;
    }

    /**
     * @param {Any} def - the default value
     * @returns { int } id of the current block, or the default value if the chunk is not generated.
     */
    idOr(def) {
        return this.tblockOrNull ? this.tblockOrNull.id : def;
    }

    /**
     * @returns { object } the properties of the current block, or null if the chunk is not generated.
     */
    get materialOrNull() {
        return this.tblockOrNull?.material;
    }

    /**
     * @returns { object } the properties of the current block, or {@link BLOCK.DUMMY}
     *      if the chunk is not generated.
     */
    get materialOrDUMMY() {
        return this.tblockOrNull?.material ?? BLOCK.DUMMY;
    }

    /**
     * @param {Any} def - the default value
     * @returns { object } the properties of the current block, or the default value
     *      if the chunk is not generated.
     */
    materialOr(def) {
        return this.tblockOrNull?.material ?? def;
    }

    /**
     * @returns {TBlock} vurrent tblock, or chunkManager.DUMMY if the chunk is not generated.
     *      Note: the same instance is reused and it can't rememberd for any prolonged time.
     *      It's valid only unil the position changes.
     */
    get tblockOrDummy() {
        return this.tblockOrNull ?? this.chunkManager.DUMMY;
    }

    _setRelPos(rx, ry, rz) {
        this._vec.setScalar(rx, ry, rz);
        this._tmpTBlock.index = rx * CHUNK_CX + ry * CHUNK_CY + rz * CHUNK_CZ + CHUNK_CW;
    }

    _rebase(x, y, z) {
        const addr = getChunkAddr(x, y, z, tmp_BlockAccessor_Vector);
        const cliSrvCompatbility = this.chunkManager.chunks || this.chunkManager;
        // This accounts both for missing chunks, and for blocks not generated
        let tb = cliSrvCompatbility.get(addr)?.tblocks;

        if (tb) {
            this._tbCoord = tb.coord;
            this.tblockOrNull = this._tmpTBlock;
            this.tblockOrNull.tb = tb;
        } else {
            chunkAddrToCoord(addr, this._tmpTbCoord);
            this._tbCoord = this._tmpTbCoord;
            this.tblockOrNull = null;
        }
        this._setRelPos(x - this._tbCoord.x, y - this._tbCoord.y, z - this._tbCoord.z);
    }
}