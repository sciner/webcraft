import {QueuePagePool} from "../light/MultiQueue.js";
import {FluidChunkQueue} from "./FluidChunkQueue.js";
import {SimpleQueue} from "../helpers.js";
import {FluidChunkEvents} from "./FluidChunkEvents.js";

export class FluidWorldQueue {
    constructor(fluidWorld) {
        this.world = fluidWorld;
        this.pool = new QueuePagePool({
            pageSize: 256,
            bytesPerElement: 2,
        });
        this.dirtyChunks = new SimpleQueue();
        this.deltaChunks = [];
        this.eventChunks = new SimpleQueue();

        //ticker
        this.tick = 0;
        this.preTick = 0;

        // constants
        this.lavaSpeed = 6; // 3
        this.lavaLower = 2;
        this.fluidTickRate = 5; // 1
    }

    addChunk(fluidChunk) {
        fluidChunk.queue = new FluidChunkQueue(this.world, fluidChunk);
        fluidChunk.events = new FluidChunkEvents(this.world, fluidChunk);
    }

    removeChunk(fluidChunk) {
        fluidChunk.queue.dispose();
        fluidChunk.events.dispose();
    }

    async process(msLimit = 8) {
        const start = performance.now();
        const {dirtyChunks, eventChunks} = this;
        this.preTick = (this.preTick + 1) % this.fluidTickRate;
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
            const chunkQueue = dirtyChunks.shift();
            if (!chunkQueue.fluidChunk.parentChunk.fluid) {
                continue;
            }
            chunkQueue.markClean();
            chunkQueue.process();
            if (performance.now() - start >= msLimit) {
                break;
            }
        }
        const {deltaChunks} = this;
        for (let i = 0; i < deltaChunks.length; i++)
        {
            const chunkQueue = deltaChunks[i];
            chunkQueue.deltaDirty = false;
            const fluidChunk = chunkQueue.fluidChunk;
            if (chunkQueue.deltaPure) {
                fluidChunk.parentChunk.sendFluidDelta(chunkQueue.packDelta());
            } else {
                fluidChunk.parentChunk.sendFluid(fluidChunk.saveDbBuffer());
            }
        }
        deltaChunks.length = 0;

        len = eventChunks.length;
        for (i = 0; i < len; i++) {
            const chunkEvents = eventChunks.shift();
            const parentChunk = chunkEvents.fluidChunk.parentChunk
            if (!parentChunk.fluid) {
                continue;
            }
            chunkEvents.process((pos, isFluidChangeAbove) => {
                parentChunk.onFluidEvent(pos, isFluidChangeAbove);
            });
            parentChunk.applyChangesByListeners();
            if (performance.now() - start >= msLimit) {
                break;
            }
        }
    }
}