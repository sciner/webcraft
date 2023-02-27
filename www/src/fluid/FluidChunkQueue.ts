import {
    FLUID_FLOOD_FLAG,
    FLUID_LAVA_ID,
    FLUID_LEVEL_MASK, FLUID_SOLID16, FLUID_STRIDE,
    FLUID_TYPE_MASK, FLUID_WATER_ID, OFFSET_FLUID,
} from "./FluidConst.js";
import {
    BLOCK
} from "./../blocks.js";
import {SingleQueue} from "../light/MultiQueue.js";
import {AABB} from "../core/AABB.js";
import {WorldAction} from "../world_action.js";
import {Vector} from "../helpers.js";
import {ServerClient} from "../server_client.js";
import type { FluidChunk } from "./FluidChunk.js";
import type { FluidWorld } from "./FluidWorld.js";

let neib = [0, 0, 0, 0, 0, 0], neibDown = [0, 0, 0, 0, 0, 0], neibChunk = [null, null, null, null, null, null];
const dx = [0, 0, 0, 0, 1, -1], dy = [1, -1, 0, 0, 0, 0], dz = [0, 0, -1, 1, 0, 0];
const QUEUE_PROCESS = 128;
const QUEUE_MASK_NUM = 127;
const MAX_TICKS = 7;

let assignValues = new Uint8Array(0),
    assignIndices = [],
    assignNum = 0,
    lavaCast = [],
    knownPortals = [],
    portalNum = 0;

function pushKnownPortal(wx, wy, wz, ticks) {
    for (let i = 0; i < portalNum; i++) {
        const toRegion = knownPortals[i].toRegion;
        if (toRegion.aabb.contains(wx, wy, wz)) {
            //TODO: push for next instead!
            const fluidChunk = toRegion.rev.fluid;
            const ind = toRegion.indexByWorld(wx, wy, wz);
            fluidChunk.queue.pushTickIndex(ind, ticks);
        }
    }
}

function shouldGoToQueue(uint16View, index, cx, cy, cz, lower) {
    const val = uint16View[index];
    const fluidType = val & FLUID_TYPE_MASK, lvl = val & FLUID_LEVEL_MASK;

    neib[0] = uint16View[index + cy];
    neib[1] = uint16View[index - cy];
    neib[2] = uint16View[index - cz];
    neib[3] = uint16View[index + cz];
    neib[4] = uint16View[index + cx];
    neib[5] = uint16View[index - cx];

    const EMPTY_MASK = FLUID_TYPE_MASK | FLUID_SOLID16;

    const lessThan = (lvl & 7) - lower;
    const moreThan = (lvl & 7) + lower;

    let hasImprovement = false;

    let hasSideFlow = false, hasEmpty = false;
    let goesSides = lvl === 0;
    let hasSupport = lvl === 0 || lvl === 8 && (neib[0] & FLUID_TYPE_MASK) === fluidType;
    // check down
    if ((neib[1] & FLUID_SOLID16) !== 0) {
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
        } else {
            hasImprovement = true;
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

    if ((val & FLUID_FLOOD_FLAG) !== 0) {
        const blockDown = (neib[1] & FLUID_SOLID16) > 0;
        for (let dir = 1; dir < 6; dir++) {
            if ((neib[dir] & FLUID_FLOOD_FLAG) !== 0) {
                //nothing
            } else if ((neib[dir] & FLUID_TYPE_MASK) === fluidType) {
                hasImprovement = (neib[dir] & FLUID_LEVEL_MASK) !== 0;
            } else {
                hasImprovement = dir === 1
                    || blockDown
                    || (neibDown[dir] & FLUID_TYPE_MASK) > 0
                    || (neibDown[dir] & (FLUID_LEVEL_MASK | FLUID_SOLID16)) > 0
            }
            if (hasImprovement) {
                return true;
            }
        }
        return false;
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
                hasSideFlow = hasSideFlow || neibLvl > lvl;
                hasSupport = hasSupport || neibLvl < lvl;
            }
        } else if (moreThan < 8 && goesSides) {
            // empty neib - we can go there
            hasEmpty = true;
            if ((neibDown[dir] & EMPTY_MASK) === 0) {
                hasImprovement = true;
            }
        }
        if (hasImprovement) {
            return true;
        }
    }
    hasImprovement = hasImprovement || !hasSupport || (hasEmpty && !hasSideFlow);
    return hasImprovement;
}

export class FluidChunkQueue {
    [key: string]: any;

    fluidWorld: FluidWorld
    fluidChunk: FluidChunk

    constructor(fluidWorld: FluidWorld, fluidChunk: FluidChunk) {
        this.fluidWorld = fluidWorld;
        this.fluidChunk = fluidChunk;
        this.lists = [];
        for (let i = 0; i < MAX_TICKS; i++) {
            this.lists.push(new SingleQueue({
                pagePool: this.fluidWorld.queue.pool,
            }));
        }
        this.qplace = null;
        this.inQueue = false;
        this.curList = 0;
        this.nextList = 1;
        this.curFlag = 1;
        this.lastTick = -1;
        //TODO: several pages, depends on current fluid tick

        //TODO: switch this to actual deltas
        this.deltaDirty = false;
        this.deltaPure = true;
        this.deltaIndices = [];
    }

    ensurePlace() {
        if (!this.qplace) {
            this.qplace = new Uint8Array(this.fluidChunk.uint16View.length);
        }
        return this.qplace;
    }

    swapLists() {
        this.curList = (this.curList + 1) % MAX_TICKS;
        this.nextList = (this.nextList + 1) % MAX_TICKS;
        this.curFlag = (1 << this.curList);

        for (let i = 0; i < MAX_TICKS; i++) {
            if (this.lists[i].head) {
                this.markDirty();
                break;
            }
        }
    }

    pushNextIndex(index, ticks = 1) {
        const qplace = this.ensurePlace();
        let ntick = (this.curList + ticks) % MAX_TICKS;
        let flag = 1 << ntick;
        if ((qplace[index] & flag) !== 0) {
            return;
        }
        this.lists[ntick].push(index);
        qplace[index] |= flag;
    }

    pushAllNeibs(lx, ly, lz) {
        const {fluidChunk} = this;
        const {cx, cy, cz, shiftCoord, pos, aabb, safeAABB, portals} = fluidChunk.dataChunk;
        const {uint16View} = fluidChunk;
        const {lavaSpeed} = this.fluidWorld.queue;
        const wx = lx + pos.x, wy = ly + pos.y, wz = lz + pos.z;

        portalNum = 0;
        if (!safeAABB.contains(wx, wy, wz)) {
            for (let i = 0; i < portals.length; i++) {
                if (portals[i].aabb.contains(wx, wy, wz)) {
                    knownPortals[portalNum++] = portals[i];
                }
            }
        }

        for (let dir = 0; dir < 6; dir++) {
            let nx = wx + dx[dir], ny = wy + dy[dir], nz = wz + dz[dir];
            let nIndex = nx * cx + ny * cy + nz * cz + shiftCoord;
            let fluidType = uint16View[nIndex] & FLUID_TYPE_MASK;
            if (fluidType !== 0) {
                //push it!
                const ticks = fluidType === FLUID_LAVA_ID ? lavaSpeed : 1;
                if (aabb.contains(nx, ny, nz)) {
                    this.pushTickIndex(nIndex);
                } else {
                    pushKnownPortal(nx, ny, nz, ticks);
                }
            }
        }
    }

    pushTickGlobal(wx, wy, wz, tick) {
        const ind = this.fluidChunk.dataChunk.indexByWorld(wx, wy, wz);
        this.pushTickIndex(ind, tick);
    }

    assignGlobal(wx, wy, wz, ticks, newVal) {
        const {fluidChunk} = this;
        const ind = fluidChunk.dataChunk.indexByWorld(wx, wy, wz);
        fluidChunk.updateID++;
        fluidChunk.markDirtyDatabase();
        const oldVal = fluidChunk.uint8View[ind * FLUID_STRIDE + OFFSET_FLUID];
        fluidChunk.uint8View[ind * FLUID_STRIDE + OFFSET_FLUID] = newVal;
        const portals2 = fluidChunk.dataChunk.portals;
        fluidChunk.setValuePortals(ind, wx, wy, wz, newVal, portals2, portals2.length);
        this.pushTickIndex(ind, ticks);
        this.markDeltaIndex(ind);
        fluidChunk.events.pushCoord(ind, wx, wy, wz, newVal);
        if ((oldVal & FLUID_TYPE_MASK) !== (newVal & FLUID_TYPE_MASK)) {
            fluidChunk.parentChunk.light?.currentDelta.push(ind);
        }
    }

    pushTickIndex(index, tick = 1) {
        const qplace = this.ensurePlace();

        let ntick = (this.curList + tick) % MAX_TICKS;
        if (this.lastTick < this.fluidWorld.queue.tick && this.inQueue) {
            ntick = (ntick + 1) % MAX_TICKS;
        }
        let flag = 1 << ntick;
        if ((qplace[index] & flag) !== 0) {
            return;
        }
        this.lists[ntick].push(index);
        qplace[index] |= flag;
        this.markDirty();
    }

    initInBounds(localBounds) {
        const {fluidChunk} = this;
        const {uint16View} = fluidChunk;
        const {cx, cy, cz, cw} = fluidChunk.dataChunk;
        const {lavaLower} = this.fluidWorld.queue;
        for (let y = localBounds.y_min; y <= localBounds.y_max; y++) {
            for (let z = localBounds.z_min; z <= localBounds.z_max; z++)
                for (let x = localBounds.x_min; x <= localBounds.x_max; x++) {
                    let index = x * cx + y * cy + z * cz + cw;
                    const val = uint16View[index];
                    const fluidType = val & FLUID_TYPE_MASK, lvl = val & FLUID_LEVEL_MASK;
                    if (fluidType === 0) {
                        continue;
                    }
                    const lower = fluidType === FLUID_LAVA_ID ? lavaLower : 1;
                    if (shouldGoToQueue(uint16View, index, cx, cy, cz, lower)) {
                        this.pushNextIndex(index, 0);
                    }
                }
        }
        if (this.lists[this.curList].head) {
            this.markDirty();
        }
    }

    init() {
        const {fluidChunk} = this;
        const bounds = new AABB();
        bounds.copyFrom(fluidChunk.getLocalBounds());
        this.initInBounds(bounds);
        fluidChunk.events.initInBounds(bounds);
        const {facetPortals} = fluidChunk.dataChunk;

        for (let i = 0; i < facetPortals.length; i++) {
            const {pos, rev, aabb} = facetPortals[i].toRegion;
            bounds.setIntersect(facetPortals[i].aabb, aabb);
            //TODO: use correct bounds vars in fluids
            bounds.x_min -= pos.x;
            bounds.x_max -= pos.x + 1;
            bounds.y_min -= pos.y;
            bounds.y_max -= pos.y + 1;
            bounds.z_min -= pos.z;
            bounds.z_max -= pos.z + 1;
            rev.fluid.queue.initInBounds(bounds);
        }
    }

    markDirty() {
        if (!this.inQueue) {
            this.fluidWorld.queue.dirtyChunks.push(this);
            this.inQueue = true;
            this.lastTick = this.fluidWorld.queue.tick;
        }
    }

    markDeltaIndex(index) {
        this.markDelta();
        if (this.deltaPure && (this.deltaIndices.length + 1) * 3 < this.fluidChunk.lastSavedSize) {
            this.deltaIndices.push(index);
        } else {
            this.deltaPure = false;
        }
    }

    markDeltaArray(indices, num) {
        this.markDelta();
        if (this.deltaPure && (this.deltaIndices.length + num) * 3 < this.fluidChunk.lastSavedSize) {
            for (let i = 0; i < num; i++) {
                this.deltaIndices.push(indices[i]);
            }
        } else {
            this.deltaPure = false;
        }
    }

    /** Packs fluid at the specified position in the same format as {@link packDelta}. */
    static packAsDelta(worldPos: Vector, fluidChunk: FluidChunk): Uint8Array {
        const buf = new Uint8Array(1 * 3);
        const ind = fluidChunk.dataChunk.indexByWorld(worldPos.x, worldPos.y, worldPos.z)
        const i = 0
        buf[i * 3] = ind & 0xff;
        buf[i * 3 + 1] = (ind >> 8) & 0xff;
        buf[i * 3 + 2] = (fluidChunk.uint16View[ind] & 0xff);
        return buf
    }

    packDelta(): Uint8Array {
        const {deltaIndices, fluidChunk} = this;
        const buf = new Uint8Array(deltaIndices.length * 3);
        for (let i = 0; i < deltaIndices.length; i++) {
            const ind = deltaIndices[i];
            // this code must be the same as in packAsDelta()
            buf[i * 3] = ind & 0xff;
            buf[i * 3 + 1] = (ind >> 8) & 0xff;
            buf[i * 3 + 2] = (fluidChunk.uint16View[ind] & 0xff);
        }
        deltaIndices.length = 0;
        return buf;
    }

    markDelta() {
        if (!this.deltaDirty) {
            this.deltaDirty = true;
            this.deltaPure = true;
            this.deltaIndices.length = 0;
            this.fluidWorld.queue.deltaChunks.push(this);
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
            const oldVal = uint8View[ind * FLUID_STRIDE + OFFSET_FLUID];
            const newVal = assignValues[ind];
            uint8View[ind * FLUID_STRIDE + OFFSET_FLUID] = newVal;
            qplace[ind] = qplace[ind] & ~QUEUE_PROCESS & ~curFlag;

            if ((oldVal & FLUID_TYPE_MASK) !== (newVal & FLUID_TYPE_MASK)) {
                fluidChunk.parentChunk.light?.currentDelta.push(ind);
            }
        }
        this.swapLists();
        if (assignNum > 0) {
            fluidChunk.updateID++;
            fluidChunk.markDirtyDatabase();
            this.markDeltaArray(assignIndices, assignNum);
        }
        for (let i = 0; i < knownPortals.length; i++) {
            knownPortals[i] = null;
        }
        for (let i = 0; i < 6; i++) {
            neibChunk[i] = null;
        }
    }

    assign(ind, wx, wy, wz, val, knownPortals, portalNum) {
        const {fluidChunk, qplace} = this;
        fluidChunk.setValuePortals(ind, wx, wy, wz, val, knownPortals, portalNum);
        if ((val & FLUID_TYPE_MASK) === FLUID_TYPE_MASK) { // WRONG FLUID TYPE
            val = 0;
        }
        assignValues[ind] = val;
        if ((qplace[ind] & QUEUE_PROCESS) === 0) {
            qplace[ind] |= QUEUE_PROCESS;
            assignIndices[assignNum++] = ind;
        }
        fluidChunk.events.pushCoord(ind, wx, wy, wz, val);
    }

    process() {
        let {lists} = this;

        this.lastTick = this.fluidWorld.queue.tick;
        lavaCast.length = 0;
        const {qplace, curList, curFlag, fluidChunk} = this;
        const {uint16View, events} = fluidChunk;
        const {cx, cy, cz, cw, shiftCoord, outerSize, safeAABB, aabb, pos, portals} = this.fluidChunk.dataChunk;
        const {lavaSpeed, lavaLower} = this.fluidWorld.queue;
        this.assignStart(uint16View.length);

        cycle: while (lists[curList].head) {
            const index = lists[curList].shift();
            let val = uint16View[index];
            let lvl = val & FLUID_LEVEL_MASK;
            let fluidType = val & FLUID_TYPE_MASK;
            if ((qplace[index] & curFlag) === 0) {
                //TODO: find out who violates this invariant
                // possibly fixed below, !curFlag to ~curFlag
                //console.log("WTF_FLUID_QUEUE");
            }
            qplace[index] &= ~curFlag;
            if (fluidType === 0) {
                continue;
            }
            const oldLvl = lvl & 7;
            const lower = fluidType === FLUID_LAVA_ID ? lavaLower : 1;
            const ticks = fluidType === FLUID_LAVA_ID ? lavaSpeed : 1;

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

            neibChunk[0] = this;
            neibChunk[1] = this;
            neibChunk[2] = this;
            neibChunk[3] = this;
            neibChunk[4] = this;
            neibChunk[5] = this;
            // -1 calc portals
            portalNum = 0;
            if (!safeAABB.contains(wx, wy, wz)) {
                for (let i = 0; i < portals.length; i++) {
                    if (portals[i].aabb.contains(wx, wy, wz)) {
                        knownPortals[portalNum++] = portals[i];
                    }
                }
                for (let dir = 0; dir < 6; dir++) {
                    let nx = wx + dx[dir], ny = wy + dy[dir], nz = wz + dz[dir];
                    if (!aabb.contains(nx, ny, nz)) {
                        neibChunk[dir] = null;
                        for (let i = 0; i < portalNum; i++) {
                            if (knownPortals[i].toRegion.aabb.contains(nx, ny, nz)) {
                                neibChunk[dir] = knownPortals[i].toRegion.rev.fluid.queue;
                            }
                        }
                    }
                }
            }

            // 0 check lavacast
            let emptied = false;
            for (let dir = 0; dir < 6; dir++) {
                let neibType = (neib[dir] & FLUID_TYPE_MASK);
                if (neibType > 0 && neibType !== fluidType) {
                    if (fluidType === FLUID_LAVA_ID && dir !== 1) {
                        if (!emptied) {
                            lavaCast.push(index);
                            if ((val & FLUID_LEVEL_MASK) === 0) {
                                lavaCast.push(BLOCK.OBSIDIAN.id);
                            } else {
                                lavaCast.push(BLOCK.COBBLESTONE.id); // cobblestone
                            }
                            emptied = true;
                        }
                    } else {
                        // need neib lava update there for lavacast!
                        let nx = wx + dx[dir], ny = wy + dy[dir], nz = wz + dz[dir];
                        if (neibChunk[dir] === this) {
                            this.pushNextIndex(cx * nx + cy * ny + cz * nz + shiftCoord, 1);
                        } else {
                            neibChunk[dir]?.pushTickGlobal(nx, ny, nz, 1);
                        }
                        if (fluidType === FLUID_WATER_ID && dir === 0) {
                            emptied = true;
                        }
                    }
                    break;
                }
            }


            // let hasNotLoadedNeib = false;
            // if (!aabb.contains(nx, ny, nz)) {
            //     for (let i = 0; i < knownPortals.length; i++) {
            //
            //     }
            // }

            let changed = emptied;
            let srcCount = 0;
            let flood = emptied ? 0 : (val & FLUID_FLOOD_FLAG);
            if (!emptied && lvl > 0 && neibChunk[0]) {
                // 1. if not source - check support
                let supportLvl = 16;
                let neibType = (neib[0] & FLUID_TYPE_MASK);
                if (neibType > 0) {
                    supportLvl = 8;
                } else {
                    for (let dir = 2; dir < 6; dir++) {
                        neibType = (neib[dir] & FLUID_TYPE_MASK);
                        if (neibType > 0) {
                            const neibLvl = neib[dir] & FLUID_LEVEL_MASK;
                            const lowLvl = (neibLvl & 7) + lower;
                            if (lowLvl < 8) {
                                supportLvl = Math.min(supportLvl, lowLvl);
                            }
                            if (neibLvl === 0) {
                                srcCount++;
                            }
                        }
                        if ((neib[dir] & FLUID_FLOOD_FLAG) !== 0) {
                            supportLvl = 0;
                            flood = FLUID_FLOOD_FLAG;
                            break;
                        }
                        if (!neibChunk[dir]) {
                            // we don't actually know!
                            supportLvl = lvl;
                            break;
                        }
                    }
                }
                if (srcCount >= 2 && ((neib[1] & FLUID_SOLID16) > 0
                    || ((neib[1] & FLUID_TYPE_MASK) === fluidType) && (neib[1] & 15) === 0)) {
                    supportLvl = 0;
                }
                if (lvl !== supportLvl) {
                    changed = true;
                    if (supportLvl === 16) {
                        emptied = true;
                    } else {
                        lvl = supportLvl;
                    }
                }
            }

            if (flood) {
                /**
                 * flood logic. its different!
                 */
                let asVal = fluidType | flood;
                const blockDown = (neib[1] & FLUID_SOLID16) > 0;
                // check top
                if ((neib[0] & FLUID_SOLID16) === 0 && (neib[0] & FLUID_TYPE_MASK) === 0) {
                    for (let dir = 2; dir < 6; dir++) {
                        let nx = wx + dx[dir], ny = wy + dy[dir] + 1, nz = wz + dz[dir];
                        let nIndex = cx * nx + cy * ny + cz * nz + shiftCoord;
                        if ((uint16View[nIndex] & FLUID_FLOOD_FLAG) > 0) {
                            //TODO: a bit slower here?
                            if (neibChunk[0] === this) {
                                this.assign(nIndex, nx, ny, nz, asVal, portals, portals.length);
                                this.pushNextIndex(nIndex, ticks);
                            } else {
                                neibChunk[0]?.assignGlobal(nx, ny, nz, ticks, asVal);
                            }
                            break;
                        }
                    }
                }
                // check sides & bottom
                for (let dir = 1; dir < 6; dir++) {
                    if ((neib[dir] & FLUID_SOLID16) > 0) {
                        continue;
                    }
                    let neibType = (neib[dir] & FLUID_TYPE_MASK);
                    let nx = wx + dx[dir], ny = wy + dy[dir], nz = wz + dz[dir];
                    let nIndex = cx * nx + cy * ny + cz * nz + shiftCoord;
                    if (neibType === fluidType) {
                        if ((neib[dir] & flood) !== flood) {
                            //add to queue here!
                            if (neibChunk[dir] === this) {
                                this.pushNextIndex(nIndex, ticks);
                            } else {
                                neibChunk[dir]?.pushTickGlobal(nx, ny, nz, ticks);
                            }
                        }
                    } else if (neibType === 0) {
                        // dif26 here?
                        if (dir === 1 || blockDown || (uint16View[nIndex - cy] & (FLUID_TYPE_MASK | FLUID_SOLID16)) > 0) {
                            // force!
                            if (neibChunk[dir] === this) {
                                // force in our chunk
                                this.assign(nIndex, nx, ny, nz, asVal, portals, portals.length);
                                this.pushNextIndex(nIndex, ticks);
                            } else {
                                // force into neib chunk
                                neibChunk[dir]?.assignGlobal(nx, ny, nz, ticks, asVal);
                            }
                        }
                    }
                }

                if (changed) {
                    this.assign(index, wx, wy, wz, asVal, knownPortals, portalNum);
                }
                continue;
            }

            let moreThan = 16;
            let goesSides = false;
            if (!emptied) {
                // if emptied, we have to check all neibs supported by this cell
                //TODO: refactor this
                moreThan = (lvl & 7) + lower;
                goesSides = lvl === 0 || moreThan < 8 && neibChunk[1] && (neib[1] & FLUID_SOLID16) > 0;
            }

            let flowMask = 0, emptyMask = 0, emptyBest = 0;
            let hasSideFlow = false;
            // 4 propagate to neibs
            let flowsDown = false;
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
                        improve = (neibType !== 0 && neibLvl === 8) != !emptied;
                        if (improve && neibType === 0) {
                            flowsDown = true;
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
                            improve = moreThan === 0;
                            //nothing
                        } else {
                            if (neibLvl > oldLvl) {
                                hasSideFlow = true;
                            }
                            improve = neibLvl > moreThan;
                            if (changed) {
                                improve ||= neibLvl === oldLvl + lower;
                            }
                        }
                    }
                }
                if (improve) {
                    flowMask |= 1 << dir;
                    if (neibChunk[dir] === this) {
                        this.pushNextIndex(nIndex, ticks);
                    } else {
                        neibChunk[dir]?.pushTickGlobal(nx, ny, nz, ticks);
                    }
                }
            }
            // TODO: bfs for shortest route like in MC
            if (emptyBest > 0) {
                emptyMask = emptyBest;
            }
            if (flowsDown) {
                emptyMask |= 1 << 1;
            }
            if (flood && lvl === 0
                && (neib[0] & FLUID_TYPE_MASK) === fluidType
                && (neib[0] & FLUID_LEVEL_MASK) !== 0) {
                emptyMask |= 0 << 1;
            }
            if (emptyMask > 0) {
                for (let dir = 0; dir < 6; dir++) {
                    if ((emptyMask & (1 << dir)) > 0) {
                        let nx = wx + dx[dir], ny = wy + dy[dir], nz = wz + dz[dir];
                        let asVal = (dir === 1 ? 8 : moreThan) | fluidType | flood;
                        if (neibChunk[dir] === this) {
                            // force in our chunk
                            let nIndex = cx * nx + cy * ny + cz * nz + shiftCoord;
                            this.assign(nIndex, nx, ny, nz, asVal, portals, portals.length);
                            this.pushNextIndex(nIndex, ticks);
                        } else {
                            // force into neib chunk
                            neibChunk[dir]?.assignGlobal(nx, ny, nz, ticks, asVal);
                        }
                    }
                }
            }
            if (changed) {
                const asVal = emptied ? 0 : (lvl | fluidType);
                this.assign(index, wx, wy, wz, asVal, knownPortals, portalNum);
            }
        }
        this.assignFinish();
        fluidChunk.parentChunk.light?.flushDelta();

        //TODO: lavacast here
        if (lavaCast.length > 0) {
            this.pushLavaCast(lavaCast);
        }
    }

    pushLavaCast(lavaCast) {
        const cm = this.fluidWorld.chunkManager;
        const world = cm.world;
        const actions = new WorldAction(randomUUID(), world, false, true);
        const chunk_coord = this.fluidChunk.dataChunk.pos;
        const {cw, outerSize} = this.fluidChunk.dataChunk;
        for (let i = 0; i < lavaCast.length; i += 2) {
            const index = lavaCast[i + 0];
            const block_id = lavaCast[i + 1];
            let tmp = index - cw;
            let x = tmp % outerSize.x;
            tmp -= x;
            tmp /= outerSize.x;
            let z = tmp % outerSize.z;
            tmp -= z;
            tmp /= outerSize.z;
            let y = tmp;
            const pos = new Vector(x, y, z).addSelf(chunk_coord);
            actions.addBlocks([{pos, item: {id: block_id}, action_id: ServerClient.BLOCK_ACTION_CREATE}]);
        }
        world.actions_queue.add(null, actions);
    }

    dispose() {
        for (let i = 0; i < MAX_TICKS; i++) {
            this.lists[i].clear();
        }
        this.fluidChunk.queue = null;
    }
}