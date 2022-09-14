import {VectorCollector} from "../helpers.js";
import {FluidChunk} from "./FluidChunk.js";
import {Worker05GeometryPool} from "../light/Worker05GeometryPool.js";
import {Basic05GeometryPool} from "../light/Basic05GeometryPool.js";
import {FluidGeometryPool} from "./FluidGeometryPool.js";
import {buildFluidVertices} from "./FluidMesher.js";

export class FluidWorld {
    constructor(chunkManager) {
        this.chunkManager = chunkManager;

        this.geometryPool = new Worker05GeometryPool(null, {
            instanceSize: 48,
            pageSize: 85,
        });
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
            dataId: (chunk.dataId !== undefined)? chunk.dataId : chunk.getDataTextureOffset(),
            parentChunk: chunk,
            world: this
        });
        chunk.tblocks.fluid = chunk.fluid;
        this.dirtyChunks.push(chunk.fluid);
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
            fluidChunk.dirty = false;
            fluidChunk.clearInstanceBuffers();
            let serialized = {};
            if (buildFluidVertices(fluidChunk) > 0) {
                limit--;
                serialized = fluidChunk.serializeInstanceBuffers();
            }
            fluidChunk.parentChunk.applyVertices('fluid', this.renderPool, serialized);
        }
        dirtyChunks.length = 0;
    }
}
