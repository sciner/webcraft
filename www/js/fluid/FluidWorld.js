import {getChunkAddr, Vector, VectorCollector} from "../helpers.js";
import {FluidChunk} from "./FluidChunk.js";
import {FLUID_STRIDE, FLUID_TYPE_MASK, FLUID_WATER_ID, OFFSET_FLUID} from "./FluidConst.js";

export class FluidWorld {
    constructor(chunkManager) {
        this.chunkManager = chunkManager;
        this.mesher = null;
    }

    addChunk(chunk) {
        chunk.fluid = new FluidChunk({
            dataChunk: chunk.dataChunk,
            dataId: chunk.getDataTextureOffset ? chunk.getDataTextureOffset() : chunk.dataId,
            parentChunk: chunk,
            world: this
        });

        chunk.tblocks.fluid = chunk.fluid;
        if (this.mesher) {
            this.mesher.dirtyChunks.push(chunk.fluid);
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
