import {FLUID_GENERATED_FLAG, FLUID_WATER_ID} from "./FluidConst.js";

export class FluidChunk {
    constructor({dataChunk, dataId, parentChunk = null}) {
        this.dataChunk = dataChunk;
        this.dataId = dataId;

        this.parentChunk = parentChunk;
        this.uint8View = parentChunk.tblocks.fluid = new Uint8Array(this.dataChunk.outerLen);
        // depends on client/server/worker it should be different
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
                other.rev.fluid.uint8View[other.indexByWorld(wx, wy, wz)] = value;
                pcnt++;
            }
        }

        return pcnt;
    }

    isFluid(id) {
        return id == 200 || id == 202 || id == 170 || id == 171;
    }

    setFluidIndirect(x, y, z, block_id) {
        const { cx, cy, cz, cw } = this.tblocks.dataChunk;
        const { uint8View } = this;
        const index = cx * x + cy * y + cz * z + cw;

        if (block_id === 200 || block_id === 202) {
            uint8View[index] = FLUID_WATER_ID | FLUID_GENERATED_FLAG;
        }
        if (block_id === 170 || block_id === 171) {
            uint8View[index] = FLUID_LAVA_ID | FLUID_GENERATED_FLAG;
        }
    }
}
