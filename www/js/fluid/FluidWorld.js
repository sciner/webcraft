import {getChunkAddr, Vector, VectorCollector} from "../helpers.js";
import {FluidChunk} from "./FluidChunk.js";
import {Worker05GeometryPool} from "../light/Worker05GeometryPool.js";
import {Basic05GeometryPool} from "../light/Basic05GeometryPool.js";
import {FluidGeometryPool} from "./FluidGeometryPool.js";
import {buildFluidVertices} from "./FluidMesher.js";
import {FLUID_SOURCE_MASK, FLUID_STRIDE, FLUID_TYPE_MASK, FLUID_WATER_ID, OFFSET_FLUID} from "./FluidConst.js";

export class FluidWorld {
    constructor(chunkManager) {
        this.chunkManager = chunkManager;

        this.geometryPool = new Worker05GeometryPool(null, {
            instanceSize: 48,
            pageSize: 85,
        });
        this.trackDirty = false;
        this.dirtyChunks = [];
        this.renderPool = null;
    }

    initRenderPool(context) {
        if (this.renderPool) {
            return;
        }
        this.renderPool = new FluidGeometryPool(context, {
            pageSize: 85,
        });
    }

    addChunk(chunk) {
        chunk.fluid = new FluidChunk({
            dataChunk: chunk.dataChunk,
            dataId: chunk.getDataTextureOffset ? chunk.getDataTextureOffset() : chunk.dataId,
            parentChunk: chunk,
            world: this
        });

        chunk.tblocks.fluid = chunk.fluid;
        if (this.trackDirty) {
            this.dirtyChunks.push(chunk.fluid);
        }
        // fillOuter for water here!!!
    }

    removeChunk(chunk) {
        if (!chunk.fluid) {
            return;
        }
        chunk.fluid.dispose();
        chunk.fluid = null;
    }

    buildDirtyChunks(maxApplyVertexCount = 10) {
        const {dirtyChunks} = this;
        let limit = maxApplyVertexCount;
        while (dirtyChunks.length > 0 && limit > 0) {
            const fluidChunk = dirtyChunks.shift();
            const {parentChunk} = fluidChunk;
            if (!parentChunk.getChunkManager()) {
                continue;
            }
            fluidChunk.dirty = false;
            fluidChunk.clearInstanceBuffers();
            let serialized = {};
            if (buildFluidVertices(fluidChunk) > 0) {
                limit--;
                serialized = fluidChunk.serializeInstanceBuffers();
            }
            parentChunk.applyVertices('fluid', this.renderPool, serialized);
        }
    }

    applyWorldFluidsList(fluids) {
        if (!fluids || fluids.length === 0) {
            return;
        }
        let chunks = new VectorCollector();
        let chunk_addr = new Vector();
        for (let i = 0; i < fluids.length; i += 4) {
            let x = fluids[i], y = fluids[i + 1], z = fluids[i + 2], val = fluids[i + 3];
            getChunkAddr(x, y, z, chunk_addr);

            let chunk = chunks.get(chunk_addr);
            if (!chunk) {
                chunk = this.chunkManager.getChunk(chunk_addr);
                chunks.add(chunk_addr, chunk);
                if (!chunk) {
                    continue;
                }
            }
            chunk.fluid.setValue(x - chunk.coord.x, y - chunk.coord.y, z - chunk.coord.z, val);
        }
        //chunks
        return chunks;
    }


    /**
     * utility functions
     */
    getValue(x, y, z) {
        let chunk_addr = getChunkAddr(x, y, z);
        let chunk = this.chunkManager.getChunk(chunk_addr);
        if (!chunk) {
            return 0;
        }
        return chunk.fluid.uint8View[FLUID_STRIDE * chunk.dataChunk.indexByWorld(x, y, z) + OFFSET_FLUID];
    }

    isWater(x, y, z) {
        return (this.getValue(x, y, z) & FLUID_TYPE_MASK) === FLUID_WATER_ID;
    }
}
