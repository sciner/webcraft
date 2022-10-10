import {QueuePagePool} from "../light/MultiQueue.js";
import {FluidChunkQueue} from "./FluidChunkQueue.js";

export class FluidWorldQueue {
    constructor(world) {
        this.world = world;
        this.pool = new QueuePagePool({
            pageSize: 256,
            bytesPerElement: 2,
        });
    }

    addChunk(fluidChunk) {
        fluidChunk.queue = new FluidChunkQueue(this, fluidChunk);
        fluidChunk.queue.init();
    }

    removeChunk(fluidChunk) {
        fluidChunk.queue.dispose();
    }
}