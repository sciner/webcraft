import {VectorCollector} from "../helpers.js";
import {FluidChunk} from "./FluidChunk.js";
import {Worker05GeometryPool} from "../light/Worker05GeometryPool.js";

export class FluidWorld {
    constructor(chunkManager) {
        this.chunkManager = chunkManager;

        this.geometryPool = new Worker05GeometryPool(null, {});
    }

    addChunk(chunk) {
        chunk.fluid = new FluidChunk({
            dataChunk: chunk.dataChunk,
            dataId: chunk.dataId,
            parentChunk: chunk,
            world: this});
        chunk.tblocks.fluid = chunk.fluid;
        // fillOuter for water here!!!
    }

    removeChunk(chunk) {
        chunk.fluid = null;
    }
}
