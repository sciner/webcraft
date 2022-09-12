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
            dataId: chunk.dataId,
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

    buildDirtyChunks() {
        const {dirtyChunks} = this;
        for (let i = 0; i < dirtyChunks.length; i++) {
            const fluidChunk = dirtyChunks[i];
            fluidChunk.dirty = false;
            buildFluidVertices(fluidChunk);
        }
        dirtyChunks.length = 0;
    }
}
