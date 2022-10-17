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

        //ticker
        this.tick = 0;
        this.preTick = 0;

        // constants
        this.lavaSpeedSlow = 6;
        this.lavaLower = 2;
        this.tickRate = 1;
    }

    addChunk(fluidChunk) {
        fluidChunk.queue = new FluidChunkQueue(this.world, fluidChunk);
    }

    removeChunk(fluidChunk) {
        fluidChunk.queue.dispose();
    }

    async process(msLimit = 8) {
        const start = performance.now();
        const {dirtyChunks} = this;
        this.preTick = (this.preTick + 1) % this.tickRate;
        if (this.preTick !== 0) {
            return;
        }
        this.tick++;
        if (dirtyChunks.length === 0) {
            return;
        }
        let i;
        let len = dirtyChunks.length;
        for (i = 0; i < len; i++) {
            const chunkQueue = dirtyChunks[i];
            if (!chunkQueue.fluidChunk.parentChunk.fluid) {
                continue;
            }
            chunkQueue.markClean();
            chunkQueue.process();
            if (performance.now() - start >= msLimit) {
                break;
            }
        }
        if (i > 0) {
            dirtyChunks.splice(0, i);
        }
    }
}