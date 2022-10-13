import {
    FLUID_LAVA_ID,
    FLUID_LEVEL_MASK, FLUID_PROPS_MASK16, FLUID_QUEUE16, FLUID_SOLID16,
    FLUID_TYPE_MASK, FLUID_WATER_ID,
} from "./FluidConst.js";
import {
    BLOCK
} from "./../blocks.js";
import {SingleQueue} from "../light/MultiQueue.js";

let neib = [0, 0, 0, 0, 0, 0], neibDown = [0, 0, 0, 0, 0, 0];
let assignedValues = new Uint16Array(0),
    assignedIndices = new Uint16Array(0),
    lavaCast = [];
function shouldGoToQueue(uint16View, index, cx, cy, cz) {
    const val = uint16View[index];
    const fluidType = val & FLUID_TYPE_MASK, lvl = val & FLUID_LEVEL_MASK;

    neib[0] = uint16View[index + cy];
    neib[1] = uint16View[index - cy];
    neib[2] = uint16View[index - cz];
    neib[3] = uint16View[index + cz];
    neib[4] = uint16View[index + cx];
    neib[5] = uint16View[index - cx];

    const EMPTY_MASK = FLUID_TYPE_MASK | FLUID_SOLID16;

    const lower = fluidType === FLUID_LAVA_ID ? 3 : 1;
    const lessThan = (lvl & 7) - lower;
    const moreThan = (lvl & 7) + lower;

    let hasImprovement = false;

    let hasDownFlow = false, hasEmpty = false;
    let goesSides = lvl === 0;
    let hasSupport = lvl === 0 || (neib[0] & FLUID_TYPE_MASK) === fluidType;
    // check down
    if ((neib[1] & FLUID_SOLID16) === 0) {
        goesSides = true;
    } else {
        let neibType = (neib[1] & FLUID_TYPE_MASK);
        if (neibType > 0) {
            if (neibType !== neibType) {
                //TODO: fluids need table of interaction.
                // in mods There might be something that does not interact with water/lava
                hasImprovement = true;
            } else {
                hasImprovement = (neib[i] & lvl) > 0;
            }
        }
    }

    if (hasImprovement) {
        return true;
    }

    if (goesSides) {
        neibDown[2] = uint16View[index - cz - cy];
        neibDown[3] = uint16View[index + cz - cy];
        neibDown[4] = uint16View[index + cx - cy];
        neibDown[5] = uint16View[index - cx - cy];
    }

    for (let i = 2; i < 6; i++) {
        let neibType = (neib[i] & FLUID_TYPE_MASK);
        if ((neib[i] & FLUID_SOLID16) === 0) {
            // no interaction with solid
            continue;
        }
        if (neibType > 0) {
            if (fluidType !== neibType) {
                // water affecting lava neib
                hasImprovement = fluidType === FLUID_LAVA_ID;
            } else {
                let neibLvl = (neib[1] & FLUID_LEVEL_MASK) & 7;
                hasImprovement = neibLvl < lessThan || neibLvl > moreThan;
                hasDownFlow = hasDownFlow || neibLvl > lvl;
                hasSupport = hasSupport || neibLvl < lvl;
            }
        } else if (moreThan < 8 && goesSides) {
            // empty neib - we can go there
            hasEmpty = true;
            if ((neibDown[i] & EMPTY_MASK) === 0) {
                hasImprovement = true;
            }
        }
        hasImprovement = hasImprovement || (hasEmpty & hasDownFlow);
        if (hasImprovement) {
            return true;
        }
    }
    return !hasSupport;
}

export class FluidChunkQueue {
    constructor(fluidWorld, fluidChunk) {
        this.fluidWorld = world;
        this.fluidChunk = fluidChunk;
        this.pagedList = new SingleQueue({
            pagePool: this.fluidWorld.queue.pool,
        });
        this.qplace = null;
        this.inQueue = false;
        //TODO: several pages, depends on current fluid tick
    }

    ensurePlace() {
        if (!this.qplace) {
            this.qplace = new Uint8Array(this.fluidChunk.uint16View.length);
        }
        return this.qplace;
    }

    pushIndex(index) {
        this.pagedList.push(index);
        const qplace = this.ensurePlace();
        if (qplace[index]) {
            // nothing
        } else {
            qplace[index] = 1;
        }
    }

    init() {
        const {fluidChunk, uint16View} = this;
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
                    if (shouldGoToQueue(uint16View, index, cx, cy, cz)) {
                        this.pushIndex(index);
                    }
                }
        }
        if (this.pagedList.head !== null) {
            this.markDirty();
        }
    }

    markDirty() {
        if (!this.inQueue) {
            this.fluidWorld.queue.push(this);
            this.inQueue = true;
        }
    }

    markClean() {
        this.inQueue = false;
    }

    process() {
        let { pagedList } = this;

        if (!pagedList.head) {
            return;
        }
        lavaCast.length = 0;
        const {uint16View} = this.fluidChunk;
        const {tblocks} = this.fluidChunk.parentChunk.tblocks;
        const {cx, cy, cz, cw, outerSize} = this.fluidChunk.dataChunk;
        if (assignedValues.length < uint16View.length) {
            assignedValues = new Uint16Array(uint16View.length);
            assignedIndices = new Uint16Array(uint16View.length);
        }
        let num = 0;
        cycle: while (pagedList.head) {
            const index = pagedList.shift();
            let val = uint16View[index];
            const props = val & FLUID_PROPS_MASK16;
            let lvl = val & FLUID_LEVEL_MASK;
            const fluidType = val & FLUID_TYPE_MASK;
            let curNum = num;
            assignedValues[num] = props | lvl | fluidType;
            assignedIndices[num++] = index;
            if (fluidType === 0) {
                num++;
                continue;
            }

            let tmp = index - cw;
            let x = tmp % outerSize.x;
            tmp -= x;
            tmp /= outerSize.x;
            let z = tmp % outerSize.z;
            tmp -= z;
            tmp /= outerSize.z;
            let y = tmp;

            neib[0] = uint16View[index + cy];
            neib[1] = uint16View[index - cy];
            neib[2] = uint16View[index - cz];
            neib[3] = uint16View[index + cz];
            neib[4] = uint16View[index + cx];
            neib[5] = uint16View[index - cx];

            // check lavacast
            for (let i = 0; i < 6; i++) {
                if (i === 1) {
                    continue;
                }
                let neibType = (neib[0] & FLUID_TYPE_MASK);
                if (neibType > 0 && neibType !== fluidType) {
                    if (fluidType === FLUID_LAVA_ID) {
                        lavaCast.push(index);
                        if ((val & FLUID_LEVEL_MASK) === 0) {
                            lavaCast.push(1);
                        } else {
                            lavaCast.push(2);
                        }
                    }
                    assignedValues[curNum] = 0;
                    continue cycle;
                }
            }

            // 1. check support
            let supportLvl = (val & FLUID_LEVEL_MASK) === 0 ? 16 : 0;
            let neibType = (neib[0] & FLUID_TYPE_MASK);
            if (neibType > 0) {
                supportLvl = Math.min(supportLvl, 8);
            }
            const lower = fluidType === FLUID_LAVA_ID ? 3 : 1;
            for (let i = 2; i < 6; i++) {
                neibType = (neib[0] & FLUID_TYPE_MASK);
                if (neibType > 0) {
                    const neibLvl = neib[0] & FLUID_LEVEL_MASK;
                    const lowLvl = (neibLvl & 7) + lower;
                    if (lowLvl < 8) {
                        supportLvl = Math.min(supportLvl, lowLvl);
                    }
                }
            }

            if (lvl !== supportLvl) {
                if (supportLvl === 16) {
                    // no fluid for you
                    assignedValues[curNum] = 0;
                    continue;
                }
                lvl = supportLvl;
                assignedValues[num] = props | lvl | fluidType;
            }
        }
    }

    dispose() {
        this.pagedList.clear();
        this.fluidChunk.queue = null;
    }
}