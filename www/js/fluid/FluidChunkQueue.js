import {
    FLUID_BLOCK_RESTRICT,
    FLUID_LAVA_ID,
    FLUID_LEVEL_MASK, FLUID_SOLID16,
    FLUID_STRIDE,
    FLUID_TYPE_MASK,
    OFFSET_FLUID
} from "./FluidConst.js";

function lessThan(fluid16, type, lvl) {
}

let neib = [0, 0, 0, 0, 0, 0], neibDown = [0, 0, 0, 0, 0, 0];
function willChange(uint16View, index, cx, cy, cz) {
    const val = uint16View[index];
    const fluidType = val & FLUID_TYPE_MASK, lvl = val & FLUID_LEVEL_MASK;

    neib[0] = uint16View[index + cy];
    neib[1] = uint16View[index - cy];
    neib[2] = uint16View[index - cz];
    neib[3] = uint16View[index + cz];
    neib[4] = uint16View[index + cx];
    neib[5] = uint16View[index - cx];
    neibDown[2] = uint16View[index - cz - cy];
    neibDown[3] = uint16View[index + cz - cy];
    neibDown[4] = uint16View[index + cx - cy];
    neibDown[5] = uint16View[index - cx - cy];

    const lower = fluidType === FLUID_LAVA_ID ? 3 : 1;

    neib[0] = uint16View[index + cy];
    neib[1] = uint16View[index - cy];
    neib[2] = uint16View[index - cz];
    neib[3] = uint16View[index + cz];
    neib[4] = uint16View[index + cx];
    neib[5] = uint16View[index - cx];
    neibDown[2] = uint16View[index - cz - cy];
    neibDown[3] = uint16View[index + cz - cy];
    neibDown[4] = uint16View[index + cx - cy];
    neibDown[5] = uint16View[index - cx - cy];

    let hasLowerNeib = false, hasLowerNeibDown = false;
    if (lvl + lower < 8) {
        for (let i = 2; i < 6; i++) {
            let neibType = (neib[i] & FLUID_TYPE_MASK);
            if (neibType > 0 && fluidType !== neibType) {
                //block gen!!!
            }
            if ((neib[i] & FLUID_SOLID16) === 0 || fluidType > 0 && fluidType !== neibType) {
                continue;
            }
        }
        // look at neibs
    }

    return true;
}

export class FluidChunkQueue {
    constructor(fluidWorld, fluidChunk) {
        this.fluidWorld = world;
        this.fluidChunk = fluidChunk;
        this.pagedList = new SingleQueue({
            pagePool: this.fluidWorld.queue.pool,
        });
        //TODO: several pages, depends on current fluid tick
    }

    init() {
        const {fluidChunk, fluidWorld, uint16View} = this;
        const {cx, cy, cz, cw} = fluidChunk.dataChunk;

        const bounds = fluidChunk.getLocalBounds();
        for (let y = bounds.y_min; y <= bounds.y_max; y++) {
            for (let z = bounds.z_min; z <= bounds.z_max; z++)
                for (let x = bounds.x_min; x <= bounds.x_max; x++) {
                    let index = x * cx + y * cy + z * cz + cw;
                    const val = uint16View[index];
                    const fluidType = val & FLUID_TYPE_MASK, lvl = val & FLUID_LEVEL_MASK;
                    if (fluidType === 0) {
                        continue;
                    }
                    const lower = fluidType === FLUID_LAVA_ID ? 3 : 1;


                    neib[0] = uint16View[index + cy];
                    neib[1] = uint16View[index - cy];
                    neib[2] = uint16View[index - cz];
                    neib[3] = uint16View[index + cz];
                    neib[4] = uint16View[index + cx];
                    neib[5] = uint16View[index - cx];
                    neibDown[2] = uint16View[index - cz - cy];
                    neibDown[3] = uint16View[index + cz - cy];
                    neibDown[4] = uint16View[index + cx - cy];
                    neibDown[5] = uint16View[index - cx - cy];

                    let hasLowerNeib = false, hasLowerNeibDown = false;
                    if (lvl + lower < 8) {
                        for (let i = 2; i < 6; i++) {
                            let neibType = (neib[i] & FLUID_TYPE_MASK);
                            if (neibType > 0 && fluidType !== neibType) {
                                //block gen!!!
                            }
                            if ((neib[i] & FLUID_SOLID16) === 0 || fluidType > 0 && fluidType !== neibType) {
                                continue;
                            }
                        }
                        // look at neibs
                    }
                }
        }
    }

    process() {
    }

    dispose() {
        this.pagedList.clear();
        this.fluidChunk.queue = null;
    }
}