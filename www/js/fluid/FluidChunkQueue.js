import {
    FLUID_LAVA_ID,
    FLUID_LEVEL_MASK, FLUID_SOLID16, FLUID_STRIDE,
    FLUID_TYPE_MASK, FLUID_WATER_ID, OFFSET_FLUID,
} from "./FluidConst.js";
import {
    BLOCK
} from "./../blocks.js";
import {SingleQueue} from "../light/MultiQueue.js";

let neib = [0, 0, 0, 0, 0, 0], neibDown = [0, 0, 0, 0, 0, 0];
const dx = [0, 0, 0, 0, 1, -1], dy = [1, -1, 0, 0, 0, 0], dz = [0, 0, -1, 1, 0, 0];
const QUEUE_PROCESS = 4;

let assignValues = new Uint8Array(0),
    assignIndices = [],
    assignNum = 0,
    lavaCast = [],
    knownPortals = [],
    portalNum = 0;

function pushKnownPortal(wx, wy, wz, forceVal) {
    for (let i = 0; i < portalNum; i++) {
        const toRegion = knownPortals[i].toRegion;
        if (toRegion.aabb.contains(wx, wy, wz)) {
            //TODO: push for next instead!
            const fluidChunk = toRegion.rev.fluid;
            const ind = toRegion.indexByWorld(wx, wy, wz);
            if (forceVal) {
                fluidChunk.updateID++;
                fluidChunk.markDirtyDatabase();
                fluidChunk.uint8View[ind * FLUID_STRIDE + OFFSET_FLUID] = forceVal;
                fluidChunk.setValuePortals(ind, wx, wy, wz, forceVal, knownPortals, portalNum);
            }
            fluidChunk.queue.pushCurIndex(ind);
            break;
        }
    }
}

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
                hasImprovement = (neib[1] & FLUID_LEVEL_MASK) > 0;
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

    for (let dir = 2; dir < 6; dir++) {
        let neibType = (neib[dir] & FLUID_TYPE_MASK);
        if ((neib[dir] & FLUID_SOLID16) !== 0) {
            // no interaction with solid
            continue;
        }
        if (neibType > 0) {
            if (fluidType !== neibType) {
                // water affecting lava neib
                hasImprovement = fluidType === FLUID_LAVA_ID;
            } else {
                let neibLvl = (neib[dir] & FLUID_LEVEL_MASK) & 7;
                hasImprovement = neibLvl < lessThan || neibLvl > moreThan;
                hasDownFlow = hasDownFlow || neibLvl > lvl;
                hasSupport = hasSupport || neibLvl < lvl;
            }
        } else if (moreThan < 8 && goesSides) {
            // empty neib - we can go there
            hasEmpty = true;
            if ((neibDown[dir] & EMPTY_MASK) === 0) {
                hasImprovement = true;
            }
        }
        hasImprovement = hasImprovement || (hasEmpty & !hasDownFlow);
        if (hasImprovement) {
            return true;
        }
    }
    return !hasSupport;
}

export class FluidChunkQueue {
    constructor(fluidWorld, fluidChunk) {
        this.fluidWorld = fluidWorld;
        this.fluidChunk = fluidChunk;
        this.pagedList = new SingleQueue({
            pagePool: this.fluidWorld.queue.pool,
        });
        this.nextList = new SingleQueue({
            pagePool: this.fluidWorld.queue.pool,
        });
        this.qplace = null;
        this.inQueue = false;
        this.curFlag = 1;
        this.nextFlag = 2;
        //TODO: several pages, depends on current fluid tick
    }

    ensurePlace() {
        if (!this.qplace) {
            this.qplace = new Uint8Array(this.fluidChunk.uint16View.length);
        }
        return this.qplace;
    }

    swapLists() {
        let t = this.pagedList;
        this.pagedList = this.nextList;
        this.nextList = t;
        let u = this.curFlag;
        this.curFlag = this.nextFlag;
        this.nextFlag = u;

        if (this.pagedList.head) {
            this.markDirty();
        }
    }

    pushNextIndex(index, checkFlag = this.nextFlag) {
        this.nextList.push(index);
        const qplace = this.ensurePlace();
        if ((qplace[index] & checkFlag) !== 0) {
            // nothing
        } else {
            qplace[index] |= this.nextFlag;
        }
    }

    pushAllNeibs(lx, ly, lz) {
        const {fluidChunk} = this;
        const {cx, cy, cz, shiftCoord, pos, aabb, safeAABB, portals} = fluidChunk.dataChunk;
        const {uint16View} = fluidChunk;
        const wx = lx + pos.x, wy = ly + pos.y, wz = lz + pos.z;

        portalNum = 0;
        if (!safeAABB.contains(wx, wy, wz)) {
            for (let i = 0; i < portals.length; i++) {
                if (portals[i].aabb.contains(wx, wy, wz)) {
                    knownPortals[portalNum++] = portals[i];
                }
            }
        }

        for (let i = 0; i < 6; i++) {
            let nx = wx + dx[i], ny = wy + dy[i], nz = wz + dz[i];
            let nIndex = nx * cx + ny * cy + nz * cz + shiftCoord;
            if ((uint16View[nIndex] & FLUID_WATER_ID) !== 0) {
                //push it!
                if (aabb.contains(nx, ny, nz)) {
                    this.pagedList.push(nIndex);
                    this.markDirty();
                } else {
                    pushKnownPortal(nx, ny, nz, 0);
                }
            }
        }
    }

    pushCurIndex(index, checkFlag = this.curFlag) {
        this.pagedList.push(index);
        const qplace = this.ensurePlace();
        if ((qplace[index] & checkFlag) !== 0) {
            // nothing
        } else {
            qplace[index] |= this.curFlag;
        }
        this.markDirty();
    }

    init() {
        const {fluidChunk} = this;
        const {uint16View} = fluidChunk;
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
                        this.pushNextIndex(index);
                    }
                }
        }
        if (this.nextList.head !== null) {
            this.swapLists();
        }
    }

    markDirty() {
        if (!this.inQueue) {
            this.fluidWorld.queue.dirtyChunks.push(this);
            this.inQueue = true;
        }
    }

    markClean() {
        this.inQueue = false;
    }

    assignStart(indMax) {
        if (assignValues.length < indMax) {
            assignValues = new Uint8Array(indMax);
        }
        assignNum = 0;
    }

    assignFinish() {
        const {qplace, curFlag, fluidChunk} = this;
        const {uint8View} = fluidChunk;
        for (let i = 0; i < assignNum; i++) {
            const ind = assignIndices[i];
            uint8View[ind * FLUID_STRIDE + OFFSET_FLUID] = assignValues[ind];
            qplace[ind] = qplace[ind] & ~QUEUE_PROCESS & ~curFlag;
        }
        this.swapLists();
        if (assignNum > 0) {
            fluidChunk.updateID++;
            fluidChunk.markDirtyDatabase();
            fluidChunk.parentChunk.sendFluid(fluidChunk.saveDbBuffer());
        }
        for (let i = 0; i < knownPortals.length; i++) {
            knownPortals[i] = null;
        }
    }

    assign(ind, wx, wy, wz, val, knownPortals, portalNum) {
        const {fluidChunk, qplace} = this;
        fluidChunk.setValuePortals(ind, wx, wy, wz, val, knownPortals, portalNum);
        assignValues[ind] = val;
        if ((qplace[ind] & QUEUE_PROCESS) === 0) {
            qplace[ind] |= QUEUE_PROCESS;
            assignIndices[assignNum++] = ind;
        }
    }

    process() {
        let { pagedList } = this;

        if (!pagedList.head) {
            return;
        }
        lavaCast.length = 0;
        const {qplace, curFlag, nextFlag, fluidChunk} = this;
        const {uint16View, uint8View} = fluidChunk;
        const {tblocks} = fluidChunk.parentChunk;
        const {cx, cy, cz, cw, shiftCoord, outerSize, safeAABB, aabb, pos, portals} = this.fluidChunk.dataChunk;
        this.assignStart(uint16View.length);
        cycle: while (pagedList.head) {
            const index = pagedList.shift();
            let val = uint16View[index];
            let lvl = val & FLUID_LEVEL_MASK;
            let fluidType = val & FLUID_TYPE_MASK;
            qplace[index] &= !curFlag;
            if (fluidType === 0) {
                continue;
            }
            const oldLvl = lvl & 7;

            let tmp = index - cw;
            let x = tmp % outerSize.x;
            tmp -= x;
            tmp /= outerSize.x;
            let z = tmp % outerSize.z;
            tmp -= z;
            tmp /= outerSize.z;
            let y = tmp;

            let wx = x + pos.x, wy = y + pos.y, wz = z + pos.z;

            neib[0] = uint16View[index + cy];
            neib[1] = uint16View[index - cy];
            neib[2] = uint16View[index - cz];
            neib[3] = uint16View[index + cz];
            neib[4] = uint16View[index + cx];
            neib[5] = uint16View[index - cx];

            // 0 check lavacast
            let emptied = false;
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
                    emptied = true;
                    break;
                }
            }

            // 1. check support
            let supportLvl = (val & FLUID_LEVEL_MASK) === 0 ? 0 : 16;
            let neibType = (neib[0] & FLUID_TYPE_MASK);
            if (neibType > 0) {
                supportLvl = Math.min(supportLvl, 8);
            }
            const lower = fluidType === FLUID_LAVA_ID ? 3 : 1;
            for (let dir = 2; dir < 6; dir++) {
                neibType = (neib[dir] & FLUID_TYPE_MASK);
                if (neibType > 0) {
                    const neibLvl = neib[dir] & FLUID_LEVEL_MASK;
                    const lowLvl = (neibLvl & 7) + lower;
                    if (lowLvl < 8) {
                        supportLvl = Math.min(supportLvl, lowLvl);
                    }
                }
            }

            // 2. apply support
            let changed = emptied;
            if (!changed && lvl !== supportLvl) {
                if (supportLvl === 16) {
                    // no fluid for you
                    emptied = true;
                } else {
                    lvl = supportLvl;
                    changed = true;
                }
            }

            // 3 calc portals
            portalNum = 0;
            if (!safeAABB.contains(wx, wy, wz)) {
                for (let i = 0; i < portals.length; i++) {
                    if (portals[i].aabb.contains(wx, wy, wz)) {
                        knownPortals[portalNum++] = portals[i];
                    }
                }
            }

            const moreThan = emptied ? 16 : (lvl & 7) + lower;
            let goesSides = lvl === 0 || moreThan < 8 && (neib[1] & FLUID_SOLID16) > 0;
            let flowMask = 0, emptyMask = 0, emptyBest = 0;
            // 4 propagate to neibs
            for (let dir = 1; dir < 6; dir++) {
                let nx = wx + dx[dir], ny = wy + dy[dir], nz = wz + dz[dir];
                // dif26 here?
                let nIndex = cx * nx + cy * ny + cz * nz + shiftCoord;
                let neibVal = uint16View[nIndex];
                if ((neibVal & FLUID_SOLID16) > 0) {
                    continue;
                }
                if (aabb.contains(nx, ny, nz)) {
                    if ((qplace[nIndex] & QUEUE_PROCESS) > 0) {
                        neibVal = assignValues[nIndex];
                    }
                }
                let neibType = neibVal & FLUID_TYPE_MASK;
                let neibLvl = neibVal & FLUID_LEVEL_MASK;
                let improve = false;
                if (neibType !== 0 && fluidType !== neibType) {
                    improve = true;
                } else if (neibType !== 0 && neibLvl === 0) {
                    // do nothing
                } else {
                    // same type or empty
                    if (dir === 1) {
                        // going down!
                        improve = (neibType !== 0 && neibLvl !== 8) ^ !emptied;
                        if (improve && neibType === 0) {
                            emptyMask |= 1 << dir;
                        }
                    } else {
                        // going side!
                        if (neibType === 0) {
                            if (goesSides) {
                                emptyMask |= 1 << dir;
                                if ((uint16View[nIndex - cy] & FLUID_SOLID16) === 0) {
                                    emptyBest |= 1 << dir;
                                }
                            }
                        } else if (neibLvl === 8) {
                            //nothing
                        } else {
                            improve = neibLvl > moreThan;
                            if (changed) {
                                improve |= neibLvl === oldLvl + lower;
                            }
                        }
                    }
                }
                if (improve) {
                    flowMask |= 1 << dir;
                    if (aabb.contains(nx, ny, nz)) {
                        this.pushNextIndex(nIndex);
                    } else {
                        pushKnownPortal(nx, ny, nz, 0);
                        // push into neib chunk if need
                    }
                }
            }
            // TODO: bfs for shortest route like in MC
            if (emptyMask > 0) {
                if (emptyBest > 0) {
                    emptyMask = emptyBest;
                }
                for (let dir = 1; dir < 6; dir++) {
                    if ((emptyMask & (1<<dir)) > 0) {
                        let nx = wx + dx[dir], ny = wy + dy[dir], nz = wz + dz[dir];
                        const asVal = (dir === 1 ? 8 : moreThan) | fluidType;
                        if (aabb.contains(nx, ny, nz)) {
                            // force in our chunk
                            let nIndex = cx * nx + cy * ny + cz * nz + shiftCoord;
                            this.assign(nIndex, nx, ny, nz, asVal, portals, portals.length);
                            this.pushNextIndex(nIndex);
                        } else {
                            // force into neib chunk
                            pushKnownPortal(nx, ny, nz, asVal);
                        }
                    }
                }
            }
            if (changed) {
                this.assign(index, wx, wy, wz,emptied ? 0 : (lvl | fluidType), knownPortals, portalNum);
            }
        }
        this.assignFinish();
        //TODO: lavacast here
    }

    dispose() {
        this.pagedList.clear();
        this.fluidChunk.queue = null;
    }
}