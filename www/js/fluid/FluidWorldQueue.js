import {QueuePagePool} from "../light/MultiQueue.js";
import {FluidChunkQueue} from "./FluidChunkQueue.js";

export class FluidWorldQueue {
    constructor(fluidWorld) {
        this.world = fluidWorld;
        this.pool = new QueuePagePool({
            pageSize: 256,
            bytesPerElement: 2,
        });
        this.dirtyChunks = [];
    }

    addChunk(fluidChunk) {
        fluidChunk.queue = new FluidChunkQueue(this.world, fluidChunk);
        fluidChunk.queue.init();
    }

    removeChunk(fluidChunk) {
        fluidChunk.queue.dispose();
    }

    async process(msLimit = 8) {
        const start = performance.now();
        const {dirtyChunks} = this;
        if (dirtyChunks.length === 0) {
            return;
        }
        let i;
        for (i = 0; i < dirtyChunks.length; i++) {
            const fluidChunk = dirtyChunks[i];
            if (!fluidChunk.parentChunk.fluid) {
                continue;
            }
            fluidChunk.process();
            fluidChunk.markClean();
            if (performance.now() - start >= msLimit) {
                break;
            }
        }
        if (i > 0) {
            dirtyChunks.splice(0, i);
        }
    }
}