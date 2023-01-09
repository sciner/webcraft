import { BLOCK } from "../blocks.js";
import {getChunkAddr, Vector, VectorCollector} from "../helpers.js";
import {FluidChunk} from "./FluidChunk.js";
import {
    FLUID_BLOCK_RESTRICT,
    FLUID_SOLID16,
    FLUID_STRIDE,
    FLUID_TYPE_MASK,
    FLUID_WATER_ID,
    FLUID_LAVA_ID,
    OFFSET_FLUID,
    fluidBlockProps
} from "./FluidConst.js";
import {AABB} from "../core/AABB.js";

export class FluidWorld {
    constructor(chunkManager) {
        this.chunkManager = chunkManager;
        this.world = chunkManager.getWorld();
        this.mesher = null;
        this.database = null;
        this.queue = null;

        this.blockPropsById = new Uint8Array(BLOCK.max_id + 1);
        const blockListeners = this.world.blockListeners;
        for(var id = 0; id < this.blockPropsById.length; id++) {
            var props = fluidBlockProps(BLOCK.BLOCK_BY_ID[id]);
            if (blockListeners) { // server-only
                props |= blockListeners.fluidBlockPropsById[id];
            }
            this.blockPropsById[id] = props;
        }
    }

    addChunk(chunk) {
        if (chunk.tblocks.fluid) {
            // restore!
            chunk.fluid = chunk.tblocks.fluid;
            chunk.fluid.world = this;
        } else {
            chunk.fluid = new FluidChunk({
                dataChunk: chunk.dataChunk,
                dataId: chunk.getDataTextureOffset ? chunk.getDataTextureOffset() : chunk.dataId,
                parentChunk: chunk,
                world: this
            });
            chunk.tblocks.fluid = chunk.fluid;
        }
        if (this.queue) {
            this.queue.addChunk(chunk.fluid);
        }
    }

    removeChunk(chunk) {
        if (!chunk.fluid) {
            return;
        }
        if (this.queue) {
            this.queue.removeChunk(chunk.fluid);
        }
        chunk.fluid.dispose();
        chunk.fluid = null;
    }

    startMeshing(fluidChunk) {
        if (this.mesher) {
            this.mesher.dirtyChunks.push(fluidChunk);
        }
    }

    applyWorldFluidsList(fluids) {
        let chunks = new VectorCollector();
        let {use_light} = this.chunkManager;
        if (!fluids || fluids.length === 0) {
            return chunks;
        }
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
            if (use_light) {
                //TODO: its slow!!!
                chunk.beginLightChanges();
            }
            chunk.fluid.setValue(x - chunk.coord.x, y - chunk.coord.y, z - chunk.coord.z, val);
            if (use_light) {
                chunk.endLightChanges();
            }
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

    /**
     * used by physics
     * @param x
     * @param y
     * @param z
     * @returns {number|number}
     */
    getFluidLevel(x, y, z) {
        //TODO: Make TFLuid for all those operations!
        let chunk_addr = getChunkAddr(x, y, z);
        let chunk = this.chunkManager.getChunk(chunk_addr);
        if (!chunk) {
            return 0;
        }
        const {cx, cy, cz, shiftCoord} = chunk.dataChunk;
        const ind = cx * x + cy * y + cz * z + shiftCoord;
        const fluid16 = chunk.fluid.uint16View[ind];
        let lvl = 0;
        if ((fluid16 & 0xff) > 0) {
            if ((fluid16 & FLUID_SOLID16) > 0) {
                lvl = -1;
            } else {
                const above = chunk.fluid.uint16View[ind + cy];
                // same as mc_getHeight. almost.
                lvl = ((fluid16 & FLUID_TYPE_MASK) === (above & FLUID_TYPE_MASK)) ? 1.0 : (8.0 - (fluid16 & 7)) / 9.0;
            }
        }
        return lvl + y;
    }

    isLava(x, y, z) {
        return (this.getValue(x, y, z) & FLUID_TYPE_MASK) === FLUID_LAVA_ID;
    }

    isWater(x, y, z) {
        return (this.getValue(x, y, z) & FLUID_TYPE_MASK) === FLUID_WATER_ID;
    }

    isFluid(x, y, z) {
        return (this.getValue(x, y, z) & FLUID_TYPE_MASK) !== 0;
    }

    isPosLava(pos) {
        return this.isLava(pos.x, pos.y, pos.z);
    }

    isPosWater(pos) {
        return this.isWater(pos.x, pos.y, pos.z);
    }

    isPosFluid(pos) {
        return this.isFluid(pos.x, pos.y, pos.z);
    }

    /**
     * used by Chunk setFluid
     * @param fluidChunk
     * @param syncProps whether to sync props
     */
    syncOuter(fluidChunk, syncProps = false) {
        const fluid = fluidChunk.uint16View;

        const { portals, aabb, cx, cy, cz } = fluidChunk.dataChunk;
        const cw = fluidChunk.dataChunk.shiftCoord;
        const tempAABB = new AABB();

        if (syncProps) {
            fluidChunk.syncAllProps();
        }
        for (let i = 0; i < portals.length; i++) {
            const portal = portals[i];
            const other = portals[i].toRegion;
            const otherView = other.uint16View;
            const otherChunk = other.rev;
            const otherFluid = otherChunk.fluid.uint16View;

            const cx2 = other.cx;
            const cy2 = other.cy;
            const cz2 = other.cz;
            const cw2 = other.shiftCoord;

            let otherDirtyFluid = false;
            tempAABB.setIntersect(aabb, portal.aabb);
            for (let y = tempAABB.y_min; y < tempAABB.y_max; y++)
                for (let z = tempAABB.z_min; z < tempAABB.z_max; z++)
                    for (let x = tempAABB.x_min; x < tempAABB.x_max; x++) {
                        const ind = x * cx + y * cy + z * cz + cw;
                        const ind2 = x * cx2 + y * cy2 + z * cz2 + cw2;
                        if (otherFluid[ind2] !== fluid[ind]) {
                            otherFluid[ind2] = fluid[ind];
                            otherDirtyFluid = true;
                        }
                    }
            tempAABB.setIntersect(other.aabb, portal.aabb);
            for (let y = tempAABB.y_min; y < tempAABB.y_max; y++)
                for (let z = tempAABB.z_min; z < tempAABB.z_max; z++)
                    for (let x = tempAABB.x_min; x < tempAABB.x_max; x++) {
                        const ind = x * cx + y * cy + z * cz + cw;
                        const ind2 = x * cx2 + y * cy2 + z * cz2 + cw2;
                        fluid[ind] = otherFluid[ind2];
                    }
            if (otherDirtyFluid) {
                other.rev.fluid.markDirtyMesh();
            }
        }
    }
}
