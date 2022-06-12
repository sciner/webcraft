import {Vector} from "./helpers.js";
import {TBlock, BlockNeighbours, CC, TypedBlocks as TB} from "./typed_blocks.js";
import {getChunkAddr} from "./chunk_const.js";
import { VectorCollector1D, TypedBlocks2 as TB2 } from './typed_blocks2.js';
import { DataChunk } from './core/DataChunk.js';
import { BaseChunk } from './core/BaseChunk.js';
import { AABB } from './core/AABB.js';

export function newTypedBlocks(x, y, z) {
    return new TypedBlocks3(x, y, z);
}

export class TypedBlocks3 {
    constructor(coord, chunkSize) {
        this.addr       = getChunkAddr(coord);
        this.coord      = coord;
        this.chunkSize = chunkSize;
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

        this.dataChunk = new DataChunk({ size: chunkSize, strideBytes: 2 }).setPos(coord);
        this.id = this.dataChunk.uint16View;
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
        this.vertices   = new VectorCollector1D(chunkSize, state.vertices);
        this.shapes     = new VectorCollector1D(chunkSize, state.shapes);
        this.falling    = new VectorCollector1D(chunkSize, state.falling);
        if(refresh_non_zero) {
            this.refreshNonZero();
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
            vertices: this.vertices.list,
            shapes: this.shapes.list,
            falling: this.falling.list,
        }
    }

    //
    refreshNonZero() {
        this.non_zero = 0;
        const id = this.dataChunk.uint16View;
        const len = id.length;
        for(let i = 0; i < len; i++) {
            if(id[i] !== 0) {
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
            } /*else if(is_water) {
                if(this.isWater(id_up) && this.isWater(id_down) && this.isWater(id_south) && this.isWater(id_north) && this.isWater(id_west) && this.isWater(id_east)) {
                    return true;
                }
            }*/
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
        let is_water_count = 0;
        for (let dir = 0; dir < CC.length; dir++) {
            const cb = cache[dir];
            neighbours[CC[dir].name] = cb;
            const properties = cb?.properties;
            if(!properties || properties.transparent || properties.fluid) {
                // @нельзя прерывать, потому что нам нужно собрать всех "соседей"
                neighbours.pcnt--;
            }
            if(properties && properties.is_water) {
                is_water_count++;
            }
        }
        if(is_water_count == 6) {
            neighbours.water_in_water = tblock.material.is_water;
        }

        return neighbours;
    }

    static _tmp = new Vector();

    getBlockId(x, y, z) {
        const { cx, cy, cz, cw } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        return this.id[index];
    }

    setBlockRotateExtra(x, y, z, rotate, extra_data) {
        const vec = TypedBlocks3._tmp.set(x, y, z);
        if (rotate !== undefined) {
            this.rotate.set(vec, rotate);
        }
        if (extra_data !== undefined) {
            this.extra_data.set(vec, extra_data);
        }
    }

    setBlockId(x, y, z, id) {
        const { cx, cy, cz, cw, portals, pos, safeAABB } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        this.id[index] = id;

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
                other.uint16View[other.indexByWorld(wx, wy, wz)] = id;
                pcnt++;
            }
        }

        return pcnt;
    }

    static tempAABB = new AABB();
    static tempAABB2 = new AABB();
    static tempVec = new Vector();

    setDirtyBlocks(x, y, z) {
        const { cx, cy, cz, cw, portals, pos, safeAABB } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;

        const wx = x + pos.x;
        const wy = y + pos.y;
        const wz = z + pos.z;

        let cnt = 0;
        if (this.vertices.list.has(index)) {
            this.vertices.list.delete(index);
            cnt++;
        }

        const aabb = TypedBlocks3.tempAABB;
        const aabb2 = TypedBlocks3.tempAABB2;
        const vec = TypedBlocks3.tempVec;
        aabb.set(wx - 1, wy - 1, wz - 1, wx + 2, wy + 2, wz + 2);
        aabb2.setIntersect(aabb, this.dataChunk.aabb);
        for (let x = aabb2.x_min; x < aabb2.x_max; x++)
            for (let y = aabb2.y_min; y < aabb2.y_max; y++)
                for (let z = aabb2.z_min; z < aabb2.z_max; z++) {
                    vec.set(x - pos.x, y - pos.y, z - pos.z);
                    if (this.vertices.delete(vec)) {
                        cnt++;
                    }
                }
        if (safeAABB.contains(wx, wy, wz)) {
            return 0;
        }
        //TODO: use only face-portals
        for (let i = 0; i < portals.length; i++) {
            if (portals[i].aabb.contains(wx, wy, wz)) {
                const other = portals[i].toRegion;
                aabb2.setIntersect(other.aabb, aabb);
                const tb2 = other.rev.tblocks;
                const pos2 = other.pos;
                for (let x = aabb2.x_min; x < aabb2.x_max; x++)
                    for (let y = aabb2.y_min; y < aabb2.y_max; y++)
                        for (let z = aabb2.z_min; z < aabb2.z_max; z++) {
                            vec.set(x - pos2.x, y - pos2.y, z - pos2.z);
                            if (tb2.vertices.delete(vec)) {
                                cnt++;
                            }
                        }
            }
        }

        return cnt;
    }
}

export class DataWorld {
    constructor() {
        const INF = 1000000000;
        this.base = new BaseChunk({size: new Vector(INF, INF, INF)})
            .setPos(new Vector(-INF / 2, -INF / 2, -INF / 2));
    }

    addChunk(chunk) {
        if (!chunk) {
            return;
        }
        chunk.dataChunk = chunk.tblocks.dataChunk;
        if (!chunk.dataChunk.portals) {
            return;
        }
        chunk.dataChunk.rev = chunk;
        this.base.addSub(chunk.dataChunk);
    }

    removeChunk(chunk) {
        if (!chunk || !chunk.dataChunk || !chunk.dataChunk.portals) {
            return;
        }
        this.base.removeSub(chunk.dataChunk);
    }

    /**
     * store blocks of other chunks that are seen in this chunk
     */
    syncOuter(chunk) {
        if (!chunk || !chunk.dataChunk.portals) {
            return;
        }

        const { portals, aabb, uint16View, cx, cy, cz } = chunk.dataChunk;
        const cw = chunk.dataChunk.shiftCoord;
        const tempAABB = new AABB();
        for (let i = 0; i < portals.length; i++) {
            const portal = portals[i];
            const other = portals[i].toRegion;
            const otherView = other.uint16View;

            const cx2 = other.cx;
            const cy2 = other.cy;
            const cz2 = other.cz;
            const cw2 = other.shiftCoord;

            tempAABB.setIntersect(aabb, portal.aabb);
            for (let y = tempAABB.y_min; y < tempAABB.y_max; y++)
                for (let z = tempAABB.z_min; z < tempAABB.z_max; z++)
                    for (let x = tempAABB.x_min; x < tempAABB.x_max; x++) {
                        otherView[x * cx2 + y * cy2 + z * cz2 + cw2] = uint16View[x * cx + y * cy + z * cz + cw];
                    }
            tempAABB.setIntersect(other.aabb, portal.aabb);
            for (let y = tempAABB.y_min; y < tempAABB.y_max; y++)
                for (let z = tempAABB.z_min; z < tempAABB.z_max; z++)
                    for (let x = tempAABB.x_min; x < tempAABB.x_max; x++) {
                        uint16View[x * cx + y * cy + z * cz + cw] = otherView[x * cx2 + y * cy2 + z * cz2 + cw2];
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
