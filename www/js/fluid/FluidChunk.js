import {
    FLUID_GENERATED_FLAG,
    FLUID_LAVA_ID,
    FLUID_STRIDE,
    FLUID_TYPE_MASK,
    FLUID_WATER_ID, fluidBlockProps, OFFSET_BLOCK_PROPS,
    OFFSET_FLUID
} from "./FluidConst.js";
import {BLOCK} from "../blocks.js";

export class FluidChunk {
    constructor({dataChunk, dataId, parentChunk = null, world = null}) {
        this.dataChunk = dataChunk;
        this.dataId = dataId;

        this.parentChunk = parentChunk;
        this.stride = 2;
        this.uint8View = parentChunk.tblocks.fluid = new Uint8Array(this.stride * this.dataChunk.outerLen);
        this.uint16View = parentChunk.tblocks.fluid = new Uint16Array(this.uint8View.buffer);
        // depends on client/server/worker it should be different

        this.waterGeom = null; // transparent geom
        this.lavaGeom = null; // non-transparent glowy geom
        this.world = world;
    }

    setValue(x, y, z, value) {
        const { cx, cy, cz, cw, portals, pos, safeAABB } = this.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        this.uint8View[index] = value;
        //TODO: check in liquid queue here
        const wx = x + pos.x;
        const wy = y + pos.y;
        const wz = z + pos.z;
        if (safeAABB.contains(wx, wy, wz)) {
            return 0;
        }
        let pcnt = 0;
        //TODO: use only face-portals
        for (let i = 0; i < portals.length; i++) {
            if (portals[i].aabb.contains(wx, wy, wz)) {
                const other = portals[i].toRegion;
                other.rev.fluid.uint8View[other.indexByWorld(wx, wy, wz) * FLUID_STRIDE + OFFSET_FLUID] = value;
                pcnt++;
            }
        }

        return pcnt;
    }

    setFluidIndirect(x, y, z, block_id) {
        const { cx, cy, cz, cw } = this.parentChunk.tblocks.dataChunk;
        const { uint8View } = this;
        const index = cx * x + cy * y + cz * z + cw;

        if (block_id === 200 || block_id === 202) {
            uint8View[index * FLUID_STRIDE + OFFSET_FLUID] = FLUID_WATER_ID | FLUID_GENERATED_FLAG;
        }
        if (block_id === 170 || block_id === 171) {
            uint8View[index * FLUID_STRIDE + OFFSET_FLUID] = FLUID_LAVA_ID | FLUID_GENERATED_FLAG;
        }
    }

    syncBlockProps(index, blockId) {
        this.uint8View[index * FLUID_STRIDE + OFFSET_BLOCK_PROPS]
            = blockId ? fluidBlockProps(BLOCK.BLOCK_BY_ID[blockId]) : 0;
    }

    syncAllProps() {
        const { cx, cy, cz, outerSize } = this.dataChunk;
        const { id } = this.parentChunk.tblocks;
        const { uint8View } = this;
        const { BLOCK_BY_ID } = BLOCK;

        for (let y = 0; y < outerSize.y; y++)
            for (let z = 0; z < outerSize.z; z++)
                for (let x = 0; x < outerSize.x; x++) {
                    let index = x * cx + y * cy + z * cz;
                    let props = 0;
                    const blockId = id[index];
                    if (blockId) {
                        props = fluidBlockProps(BLOCK_BY_ID[blockId]);
                    }
                    uint8View[index * FLUID_STRIDE + OFFSET_BLOCK_PROPS] = props;
                }
    }
}
