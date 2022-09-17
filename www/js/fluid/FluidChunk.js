import {
    FLUID_GENERATED_FLAG,
    FLUID_LAVA_ID,
    FLUID_STRIDE,
    FLUID_TYPE_MASK,
    FLUID_WATER_ID, fluidBlockProps, OFFSET_BLOCK_PROPS,
    OFFSET_FLUID
} from "./FluidConst.js";
import {BLOCK} from "../blocks.js";
import {FluidInstanceBuffer} from "./FluidInstanceBuffer.js";
import {AABB} from "../core/AABB.js";

export class FluidChunk {
    constructor({dataChunk, dataId, parentChunk = null, world = null}) {
        this.dataChunk = dataChunk;
        this.dataId = dataId;

        this.parentChunk = parentChunk;
        this.stride = FLUID_STRIDE;
        this.uint8View = parentChunk.tblocks.fluid = new Uint8Array(this.stride * this.dataChunk.outerLen);
        this.uint16View = parentChunk.tblocks.fluid = new Uint16Array(this.uint8View.buffer);
        // depends on client/server/worker it should be different

        this.instanceBuffers = new Map();

        this.world = world;
        this.dirty = true;
        this.boundsDirty = false;

        /**
         * local bounds INCLUDE
         * @type {AABB}
         * @private
         */
        this._localBounds = new AABB();
    }

    setValue(x, y, z, value) {
        const { cx, cy, cz, cw, portals, pos, safeAABB } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        this.uint8View[index * FLUID_STRIDE + OFFSET_FLUID] = value;
        //TODO: check in liquid queue here
        const wx = x + pos.x;
        const wy = y + pos.y;
        const wz = z + pos.z;
        this.boundsDirty = true;
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
        const { cx, cy, cz, cw, size } = this.parentChunk.tblocks.dataChunk;
        const { uint8View } = this;
        let res = false;
        this._localBounds.set(size.x, size.y, size.z, 0, 0, 0);
        cycle:for (let y = 0; y < size.y; y++)
            for (let z = 0; z < size.z; z++)
                for (let x = 0; x < size.x; x++) {
                    let index = x * cx + y * cy + z * cz + cw;
                    if (uint8View[index * FLUID_STRIDE + OFFSET_FLUID] > 0) {
                        this._localBounds.addPoint(x, y, z);
                    }
                }
        return res;
    }

    /**
     * local bounds INCLUDE
     * @returns {AABB}
     */
    getLocalBounds() {
        if (this.boundsDirty) {
            this.calcBounds();
            this.boundsDirty = false;
        }
        return this._localBounds;
    }

    isNotEmpty() {
        const bounds = this.getLocalBounds();
        return bounds.x_min > bounds.x_max && bounds.y_min > bounds.y_max && bounds.z_min > bounds.z_max;
    }

    saveDbBuffer() {
        const { cx, cy, cz, cw, size } = this.parentChunk.tblocks.dataChunk;
        const { uint8View } = this;
        const bounds = this.getLocalBounds();
        const arr = [];

        let encodeType = 1;
        arr.push(encodeType);
        arr.push(bounds.y_min, bounds.y_max);
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
            //TODO: encode 0 +1 -1 here
            arr.push(x_min, x_max, z_min, z_max);
            for (let z = z_min; z <= z_max; z++)
                for (let x = x_min; x <= x_max; x++) {
                    let index = x * cx + y * cy + z * cz + cw;
                    arr.push(uint8View[index * FLUID_STRIDE + OFFSET_FLUID]);
                }

        }
        return new Uint8Array(arr);
    }

    loadDbBuffer(stateArr) {
        const { cx, cy, cz, cw, size } = this.parentChunk.tblocks.dataChunk;
        const { uint8View } = this;
        const arr = stateArr;
        const bounds = this._localBounds;
        let k = 0;
        let encodeType = arr[k++];

        if (encodeType === 0 || encodeType >= 16) {
            // just full array
            k = 0;
            for (let y = 0; y < size.y; y++)
                for (let z = 0; z < size.z; z++)
                    for (let x = 0; x < size.x; x++) {
                        let index = x * cx + y * cy + z * cz + cw;
                        uint8View[index * FLUID_STRIDE + OFFSET_FLUID] = arr[k++];
                    }
            this.boundsDirty = true;
            return;
        }

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
                        && z >= z_min && z<= z_max) {
                        val = arr[k++];
                    }
                    let index = x * cx + y * cy + z * cz + cw;
                    uint8View[index * FLUID_STRIDE + OFFSET_FLUID] = val;
                }
        }

        this.boundsDirty = false;
    }

    setFluidIndirect(x, y, z, block_id) {
        const { cx, cy, cz, cw } = this.parentChunk.tblocks.dataChunk;
        const { uint8View } = this;
        const index = cx * x + cy * y + cz * z + cw;

        if (block_id === 200 || block_id === 202) {
            uint8View[index * FLUID_STRIDE + OFFSET_FLUID] = FLUID_WATER_ID | FLUID_GENERATED_FLAG;
        }
        if (block_id === 170 || block_id === 171) {
            uint8View[index * FLUID_STRIDE + OFFSET_FLUID] = FLUID_LAVA_ID | FLUID_GENERATED_FLAG;
        }

        this.boundsDirty = true;
    }

    syncBlockProps(index, blockId) {
        const ind = index * FLUID_STRIDE + OFFSET_BLOCK_PROPS;
        const old = this.uint8View[ind];
        const props = blockId ? fluidBlockProps(BLOCK.BLOCK_BY_ID[blockId]) : 0;
        if (props === old) {
            return;
        }
        this.uint8View[index * FLUID_STRIDE + OFFSET_BLOCK_PROPS] = props;
        if (!this.dirty) {
            this.markDirty();
        }
    }

    syncAllProps() {
        const { cx, cy, cz, outerSize } = this.dataChunk;
        const { id } = this.parentChunk.tblocks;
        const { uint8View } = this;
        const { BLOCK_BY_ID } = BLOCK;

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
        this.dirty = true;
    }

    // build the vertices!
    clearInstanceBuffers() {
        for (let entry of this.instanceBuffers) {
            entry[1].clear();
        }
    }

    getInstanceBuffer(material_key) {
        let ib = this.instanceBuffers.get(material_key);
        if (!ib) {
            this.instanceBuffers.set(material_key, ib = new FluidInstanceBuffer({
                material_key,
                geometryPool: this.world.geometryPool,
                chunkDataId: this.dataId
            }));
        }
        return ib;
    }

    serializeInstanceBuffers() {
        let serializedVertices = {};
        for (let entry of this.instanceBuffers) {
            const vb = entry[1];
            if (vb.touched && vb.vertices.filled > 0) {
                serializedVertices[vb.material_key] = vb.getSerialized();
                vb.markClear();
            } else {
                this.instanceBuffers.delete(entry[0]);
            }
        }
        return serializedVertices;
    }

    markDirty() {
        if (this.dirty || !this.world || !this.world.trackDirty) {
            return;
        }
        this.dirty = true;
        this.world.dirtyChunks.push(this);
    }

    dispose() {
        for (let buf of this.instanceBuffers.values()) {
            buf.clear();
        }
        this.instanceBuffers.clear();
        this.world = null;
    }
}
