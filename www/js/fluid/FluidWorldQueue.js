import {QueuePagePool} from "../light/MultiQueue.js";
import {FluidChunkQueue} from "./FluidChunkQueue.js";

export class FluidWorldQueue {
    constructor(world) {
        this.world = world;
        this.pool = new QueuePagePool({
            pageSize: 256,
            bytesPerElement: 2,
        });
        this.dirtyChunks = [];
    }

    addChunk(fluidChunk) {
        fluidChunk.queue = new FluidChunkQueue(this, fluidChunk);
        fluidChunk.queue.init();
    }

    removeChunk(fluidChunk) {
        fluidChunk.queue.dispose();
    }

    process(msLimit = 16) {
        const start = performance.now();
        const {dirtyChunks} = this;
        if (dirtyChunks.length === 0) {
            return;
        }
        let i;
        for (i = 0; i < dirtyChunks.length; i++) {
            dirtyChunks[i].process();
            dirtyChunks[i].markClean();
            if (performance.now() - start >= msLimit) {
                break;
            }
        }
        if (i > 0) {
            dirtyChunks.splice(0, i);
        }
    }
}