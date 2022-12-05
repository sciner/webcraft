import {
    FLUID_BLOCK_RESTRICT,
    FLUID_GENERATED_FLAG,
    FLUID_LAVA_ID,
    FLUID_STRIDE, FLUID_TYPE_MASK,
    FLUID_WATER_ID, fluidBlockProps, OFFSET_BLOCK_PROPS,
    OFFSET_FLUID
} from "./FluidConst.js";
import {BLOCK} from "../blocks.js";
import {AABB} from "../core/AABB.js";
import { gzip, ungzip } from '../../vendors/pako.esm.min.mjs';

export class FluidChunk {
    constructor({dataChunk, dataId, parentChunk = null, world = null}) {
        this.dataChunk = dataChunk;
        this.dataId = dataId;

        this.parentChunk = parentChunk;
        this.stride = FLUID_STRIDE;
        this.uint8View = parentChunk.tblocks.fluid = new Uint8Array(this.stride * this.dataChunk.outerLen);
        this.uint16View = parentChunk.tblocks.fluid = new Uint16Array(this.uint8View.buffer);
        // depends on client/server/worker it should be different

        this.instanceBuffers = null;

        this.world = world;

        this.updateID = 0;
        this.boundsID = -1;
        this.meshID = -1;

        /**
         * local bounds INCLUDE
         * @type {AABB}
         * @private
         */
        this._localBounds = new AABB();

        /**
         * this is for server
         */
        this.savedBuffer = null;
        this.savedID = -1;
        this.databaseID = 0;
        this.inSaveQueue = false;
        this.queue = null;

        this.lastSavedSize = 16384;
    }

    setValue(x, y, z, value) {
        const {cx, cy, cz, cw, portals, pos, safeAABB} = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        const old = this.uint8View[index * FLUID_STRIDE + OFFSET_FLUID];

        if (old === value) {
            return;
        }

        this.uint8View[index * FLUID_STRIDE + OFFSET_FLUID] = value;
        //TODO: check in liquid queue here
        const wx = x + pos.x;
        const wy = y + pos.y;
        const wz = z + pos.z;
        this.updateID++;
        this.markDirtyMesh();
        if (this.queue) {
            this.queue.pushTickIndex(index);
        }
        if (safeAABB.contains(wx, wy, wz)) {
            return 0;
        }
        let pcnt = 0;
        //TODO: use only face-portals
        for (let i = 0; i < portals.length; i++) {
            if (portals[i].aabb.contains(wx, wy, wz)) {
                const other = portals[i].toRegion;
                other.rev.fluid.uint8View[other.indexByWorld(wx, wy, wz) * FLUID_STRIDE + OFFSET_FLUID] = value;
                pcnt++;
            }
        }

        return pcnt;
    }

    setValuePortals(index, wx, wy, wz, value, portals, portalLen) {
        const {safeAABB} = this.dataChunk;
        if (safeAABB.contains(wx, wy, wz)) {
            return;
        }
        for (let i = 0; i < portalLen; i++) {
            if (portals[i].aabb.contains(wx, wy, wz)) {
                const other = portals[i].toRegion;
                other.rev.fluid.uint8View[other.indexByWorld(wx, wy, wz) * FLUID_STRIDE + OFFSET_FLUID] = value;
            }
        }
    }

    getValueByInd(ind) {
        return this.uint8View[ind * FLUID_STRIDE + OFFSET_FLUID];
    }

    saveState() {
        return this.uint8View;
    }

    restoreState(something) {
        this.uint8View = something;
        this.uint16View = new Uint16Array(something.buffer);
    }

    calcBounds() {
        const {cx, cy, cz, cw, size} = this.dataChunk;
        const {uint8View} = this;
        this._localBounds.set(size.x, size.y, size.z, 0, 0, 0);
        for (let y = 0; y < size.y; y++)
            for (let z = 0; z < size.z; z++)
                for (let x = 0; x < size.x; x++) {
                    let index = x * cx + y * cy + z * cz + cw;
                    if (uint8View[index * FLUID_STRIDE + OFFSET_FLUID] > 0) {
                        this._localBounds.addPoint(x, y, z);
                    }
                }
    }

    /**
     * local bounds INCLUDE
     * @returns {AABB}
     */
    getLocalBounds() {
        if (this.boundsID !== this.updateID) {
            this.calcBounds();
            this.boundsID = this.updateID;
        }
        return this._localBounds;
    }

    isNotEmpty() {
        const bounds = this.getLocalBounds();
        return bounds.x_min <= bounds.x_max && bounds.y_min <= bounds.y_max && bounds.z_min <= bounds.z_max;
    }

    incUpdate() {

    }

    saveDbBuffer() {
        if (this.savedID === this.updateID) {
            return this.savedBuffer;
        }

        const {cx, cy, cz, cw, size} = this.dataChunk;
        const {uint8View} = this;
        const bounds = this.getLocalBounds();
        let arr = [];

        let encodeType = 1; // version number
        arr.push(bounds.y_min, bounds.y_max + 1);
        for (let y = bounds.y_min; y <= bounds.y_max; y++) {
            let x_min = size.x, x_max = 0, z_min = size.z, z_max = 0;
            for (let z = bounds.z_min; z <= bounds.z_max; z++)
                for (let x = bounds.x_min; x <= bounds.x_max; x++) {
                    let index = x * cx + y * cy + z * cz + cw;
                    const val = uint8View[index * FLUID_STRIDE + OFFSET_FLUID];
                    if (val > 0) {
                        x_min = Math.min(x_min, x);
                        x_max = Math.max(x_max, x);
                        z_min = Math.min(z_min, z);
                        z_max = Math.max(z_max, z);
                    }
                }
            arr.push(x_min, x_max + 1, z_min, z_max + 1);
        }
            //TODO: encode 0 +1 -1 here
        let k = 2;
        for (let y = bounds.y_min; y <= bounds.y_max; y++) {
            let x_min = arr[k++], x_max = arr[k++] - 1, z_min = arr[k++], z_max = arr[k++] - 1;
            for (let z = z_min; z <= z_max; z++)
                for (let x = x_min; x <= x_max; x++) {
                    let index = x * cx + y * cy + z * cz + cw;
                    arr.push(uint8View[index * FLUID_STRIDE + OFFSET_FLUID]);
                }
        }

        if (arr.length > 128) {
            let arr2 = gzip(new Uint8Array(arr));
            arr = new Uint8Array(arr2.length + 1);
            arr[0] = 3;
            // gzip
            arr.set(arr2, 1);
        } else {
            // no gzip
            arr.unshift(2);
            arr = new Uint8Array(arr);
        }
        this.lastSavedSize = arr.length;

        this.savedID = this.updateID;
        return this.savedBuffer = arr;
    }

    loadDbBuffer(stateArr, fromDb) {
        const {cx, cy, cz, cw, size} = this.dataChunk;
        const {uint8View} = this;
        let arr = stateArr;
        const bounds = this._localBounds;
        let k = 0;
        let encodeType = arr[k++]; // version number

        if (encodeType === 1) {
            //old version
            bounds.set(size.x, arr[k++], size.z, 0, arr[k++], 0);
            for (let y = 0; y < size.y; y++) {
                if (y >= bounds.y_min && y <= bounds.y_max) {
                    continue;
                }
                for (let z = 0; z < size.z; z++)
                    for (let x = 0; x < size.x; x++) {
                        //TODO: calc changed bounds here
                        let index = x * cx + y * cy + z * cz + cw;
                        uint8View[index * FLUID_STRIDE + OFFSET_FLUID] = 0;
                    }
            }
            for (let y = bounds.y_min; y <= bounds.y_max; y++) {
                let x_min = arr[k++], x_max = arr[k++], z_min = arr[k++], z_max = arr[k++];
                bounds.x_min = Math.min(bounds.x_min, x_min);
                bounds.x_max = Math.max(bounds.x_max, x_max);
                bounds.z_min = Math.min(bounds.z_min, z_min);
                bounds.z_max = Math.max(bounds.z_max, z_max);

                for (let z = 0; z < size.z; z++)
                    for (let x = 0; x < size.x; x++) {
                        let val = 0;
                        if (x >= x_min && x <= x_max
                            && z >= z_min && z <= z_max) {
                            val = arr[k++];
                            if ((val & FLUID_TYPE_MASK) === FLUID_TYPE_MASK) { // WRONG FLUID TYPE
                                val = 0;
                            }
                        }
                        let index = x * cx + y * cy + z * cz + cw;
                        uint8View[index * FLUID_STRIDE + OFFSET_FLUID] = val;
                    }
            }
        } else {
            //new version!
            arr = stateArr.subarray(1, uint8View.length);
            this.lastSavedSize = arr.length;
            if (encodeType === 3) {
                arr = ungzip(arr);
            }
            k = 0;
            bounds.set(size.x, arr[k++], size.z, 0, arr[k++] - 1, 0);
            let dims = [];
            for (let y = bounds.y_min; y <= bounds.y_max; y++) {
                dims.push(arr[k++], arr[k++], arr[k++], arr[k++]);
            }
            for (let y = 0; y < size.y; y++) {
                if (y >= bounds.y_min && y <= bounds.y_max) {
                    continue;
                }
                for (let z = 0; z < size.z; z++)
                    for (let x = 0; x < size.x; x++) {
                        //TODO: calc changed bounds here
                        let index = x * cx + y * cy + z * cz + cw;
                        uint8View[index * FLUID_STRIDE + OFFSET_FLUID] = 0;
                    }
            }
            let s = 0;
            for (let y = bounds.y_min; y <= bounds.y_max; y++) {
                let x_min = dims[s++], x_max = dims[s++] - 1, z_min = dims[s++], z_max = dims[s++] - 1;
                bounds.x_min = Math.min(bounds.x_min, x_min);
                bounds.x_max = Math.max(bounds.x_max, x_max);
                bounds.z_min = Math.min(bounds.z_min, z_min);
                bounds.z_max = Math.max(bounds.z_max, z_max);

                for (let z = 0; z < size.z; z++)
                    for (let x = 0; x < size.x; x++) {
                        let val = 0;
                        if (x >= x_min && x <= x_max
                            && z >= z_min && z <= z_max) {
                            val = arr[k++];
                            if ((val & FLUID_TYPE_MASK) === FLUID_TYPE_MASK) { // WRONG FLUID TYPE
                                val = 0;
                            }
                        }
                        let index = x * cx + y * cy + z * cz + cw;
                        uint8View[index * FLUID_STRIDE + OFFSET_FLUID] = val;
                    }
            }
        }

        this.updateID++;
        this.boundsID = this.updateID;
        if (fromDb) {
            this.savedID = this.updateID;
            this.databaseID = this.updateID;
            this.savedBuffer = stateArr;
        }
    }

    setFluidIndirect(x, y, z, block_id) {
        const {cx, cy, cz, cw} = this.dataChunk;
        const {uint8View} = this;
        const index = cx * x + cy * y + cz * z + cw;

        if (block_id === 200 || block_id === 202) {
            uint8View[index * FLUID_STRIDE + OFFSET_FLUID] = FLUID_WATER_ID | FLUID_GENERATED_FLAG;
        }
        if (block_id === 170 || block_id === 171) {
            uint8View[index * FLUID_STRIDE + OFFSET_FLUID] = FLUID_LAVA_ID | FLUID_GENERATED_FLAG;
        }

        this.updateID++;
    }

    syncBlockProps(index, blockId, isPortal) {
        const ind = index * FLUID_STRIDE + OFFSET_BLOCK_PROPS;
        const old = this.uint8View[ind];
        const props = blockId ? fluidBlockProps(BLOCK.BLOCK_BY_ID[blockId]) : 0;
        if (props === old) {
            return;
        }
        this.uint8View[index * FLUID_STRIDE + OFFSET_BLOCK_PROPS] = props;

        // things to check
        // 1. mesh solid block status near fluids
        const isSolid = props & FLUID_BLOCK_RESTRICT;
        if (this.meshID >= 0 && isSolid !== (old & FLUID_BLOCK_RESTRICT) > 0) {
            const {uint16View} = this;
            const {cx, cy, cz, cw, size, outerSize} = this.dataChunk;

            //TODO: move this into a method? restricted directions
            let tmp = index - cw;
            let x = tmp % outerSize.x;
            tmp -= x;
            tmp /= outerSize.x;
            let z = tmp % outerSize.z;
            tmp -= z;
            tmp /= outerSize.z;
            let y = tmp;

            //TODO: dont check in case bounds are empty
            if (y + 1 < size.y && (uint16View[index + cy] & FLUID_TYPE_MASK) > 0
                || y - 1 >= 0 && (uint16View[index - cy] & FLUID_TYPE_MASK) > 0
                || z + 1 < size.z && (uint16View[index + cz] & FLUID_TYPE_MASK) > 0
                || z - 1 >= 0 && (uint16View[index - cz] & FLUID_TYPE_MASK) > 0
                || x + 1 < size.x && (uint16View[index + cx] & FLUID_TYPE_MASK) > 0
                || x - 1 >= 0 && (this.uint16View[index - cx] & FLUID_TYPE_MASK) > 0) {
                this.markDirtyMesh();
            }
        }
        // 2. solid block on top of fluid
        if ((this.uint16View[index] & FLUID_TYPE_MASK) > 0) {
            if (isSolid) {
                this.uint8View[index * FLUID_STRIDE + OFFSET_FLUID] = 0;
                if (!isPortal) {
                    this.updateID++;
                    this.markDirtyMesh();
                    this.markDirtyDatabase();
                }
            }
        }
        if (!isPortal && this.queue) {
            //TODO: remove this
            const {cw, outerSize} = this.dataChunk;
            let tmp = index - cw;
            let x = tmp % outerSize.x;
            tmp -= x;
            tmp /= outerSize.x;
            let z = tmp % outerSize.z;
            tmp -= z;
            tmp /= outerSize.z;
            let y = tmp;
            this.queue.pushAllNeibs(x, y, z);
        }
    }

    syncAllProps() {
        const {cx, cy, cz, outerSize} = this.dataChunk;
        const {id} = this.parentChunk.tblocks;
        const {uint8View} = this;
        const {BLOCK_BY_ID} = BLOCK;

        for (let y = 0; y < outerSize.y; y++)
            for (let z = 0; z < outerSize.z; z++)
                for (let x = 0; x < outerSize.x; x++) {
                    let index = x * cx + y * cy + z * cz;
                    let props = 0;
                    const blockId = id[index];
                    if (blockId) {
                        props = fluidBlockProps(BLOCK_BY_ID[blockId]);
                    }
                    uint8View[index * FLUID_STRIDE + OFFSET_BLOCK_PROPS] = props;
                }
    }

    applyDelta(deltaBuf, usePortals) {
        const {cw, outerSize, pos, safeAABB, portals } = this.dataChunk;

        this.updateID++;
        this.markDirtyMesh();
        for (let i = 0; i < deltaBuf.length; i += 3) {
            let ind = deltaBuf[i] + (deltaBuf[i + 1] << 8);
            let val = deltaBuf[i + 2];
            this.uint8View[ind * FLUID_STRIDE + OFFSET_FLUID] = val;

            if (!usePortals) {
                continue;
            }
            let tmp = ind - cw;
            let x = tmp % outerSize.x;
            tmp -= x;
            tmp /= outerSize.x;
            let z = tmp % outerSize.z;
            tmp -= z;
            tmp /= outerSize.z;
            let y = tmp;

            const wx = x + pos.x;
            const wy = y + pos.y;
            const wz = z + pos.z;

            if (safeAABB.contains(wx, wy, wz)) {
                continue;
            }
            let pcnt = 0;
            for (let i = 0; i < portals.length; i++) {
                if (portals[i].aabb.contains(wx, wy, wz)) {
                    const other = portals[i].toRegion;
                    other.rev.fluid.uint8View[other.indexByWorld(wx, wy, wz) * FLUID_STRIDE + OFFSET_FLUID] = val;
                    other.rev.fluid.markDirtyMesh();
                    pcnt++;
                }
            }
        }
    }

    markDirtyMesh() {
        if (this.meshID < 0) {
            return;
        }
        this.meshID = -1;
        if (!this.world) {
            return;
        }
        if (this.world.mesher) {
            this.world.mesher.dirtyChunks.push(this);
        }
    }

    markDirtyDatabase() {
        if (this.databaseID < 0) {
            return;
        }
        this.databaseID = -1;
        if (!this.world) {
            return;
        }
        if (this.world.database) {
            this.world.database.dirtyChunks.push(this);
        }
    }

    dispose() {
        this.world = null;
        if (this.instanceBuffers) {
            for (let buf of this.instanceBuffers.values()) {
                buf.clear();
            }
            this.instanceBuffers.clear();
            this.instanceBuffers = null;
        }
    }
}
