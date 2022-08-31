import {VectorCollector} from "../helpers.js";
import {FluidChunk} from "./FluidChunk.js";

export class FluidWorld {
    constructor(chunkManager) {
        this.chunkManager = chunkManager;
    }

    addChunk(chunk) {
        chunk.fluid = new FluidChunk({
            dataChunk: chunk.dataChunk,
            dataId: chunk.dataId,
            parentChunk: chunk,
            world: this});
        // fillOuter for water here!!!
    }

    removeChunk(chunk) {
        chunk.fluid = null;
    }
}
