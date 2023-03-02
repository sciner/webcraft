import {
    FLUID_TYPE_MASK, FLUID_WATER_ID, FLUID_EVENT_FLAG_ABOVE,
    FLUID_WATER_INTERACT16, FLUID_WATER_REMOVE16,
    FLUID_WATER_ABOVE_INTERACT16, FLUID_WATER_ABOVE_REMOVE16
} from "./FluidConst.js";

import {SingleQueue} from "../light/MultiQueue.js";
import { Vector } from "../helpers.js";

const QUEUE_INTERACT = 1;

export class FluidChunkEvents {
    [key: string]: any;
    constructor(fluidWorld, fluidChunk) {
        this.fluidWorld = fluidWorld;
        this.fluidChunk = fluidChunk;
        this.inQueue = false;
        this.list = new SingleQueue({
            pagePool: this.fluidWorld.queue.pool,
        });
        this.qplace = null;
    }

    ensurePlace() {
        if (!this.qplace) {
            this.qplace = new Uint8Array(this.fluidChunk.uint16View.length);
        }
        return this.qplace;
    }

    pushCoord(index, wx, wy, wz, val) {
        const { uint16View } = this.fluidChunk;
        const { cy } = this.fluidChunk.dataChunk;
        const flag = (val === 0 ? FLUID_WATER_REMOVE16 : 0) | FLUID_WATER_INTERACT16;
        if ((uint16View[index] & flag) !== 0) {
            const qplace = this.ensurePlace();
            if ((qplace[index] & QUEUE_INTERACT) === 0) {
                qplace[index] |= QUEUE_INTERACT;
                this.list.push(index);
                this.markDirty();
            }
        }
        const flagBelow = (val === 0 ? FLUID_WATER_ABOVE_REMOVE16 : 0) | FLUID_WATER_ABOVE_INTERACT16;
        if ((uint16View[index - cy] & flagBelow) !== 0) {
            const qplace = this.ensurePlace();
            if ((qplace[index - cy] & QUEUE_INTERACT) === 0) {
                const {facetPortals, aabb} = this.fluidChunk.dataChunk;
                wy--;
                if (wy >= aabb.y_min) {
                    qplace[index - cy] |= QUEUE_INTERACT;
                    this.list.push((index - cy) | FLUID_EVENT_FLAG_ABOVE);
                    this.markDirty();
                } else {
                    for (let i = 0; i < facetPortals.length; i++) {
                        const region = facetPortals[i].toRegion;
                        if (region.aabb.contains(wx, wy, wz)) {
                            region.rev.fluid.events.pushGlobal(wx, wy, wz, FLUID_EVENT_FLAG_ABOVE);
                            break;
                        }
                    }
                }
            }
        }
    }

    markDirty() {
        if (!this.inQueue) {
            this.fluidWorld.queue.eventChunks.push(this);
            this.inQueue = true;
        }
    }

    pushGlobal(wx, wy, wz, indexFlag) {
        const index = this.fluidChunk.dataChunk.indexByWorld(wx, wy, wz);
        const qplace = this.ensurePlace();
        if ((qplace[index] & QUEUE_INTERACT) !== 0) {
            return;
        }
        qplace[index] |= QUEUE_INTERACT;
        this.list.push(index | indexFlag);
        this.markDirty();
    }

    initInBounds(localBounds) {
        const {fluidChunk} = this;
        const {uint16View} = fluidChunk;
        const {cx, cy, cz, facetPortals, aabb} = fluidChunk.dataChunk;
        let downPortals = [];
        for (let i = 0; i < facetPortals.length; i++) {
            if (facetPortals[i].aabb.y_min < aabb.y_min) {
                downPortals.push(facetPortals[i]);
            }
        }

        for (let y = localBounds.y_min - 1; y <= localBounds.y_max; y++)
            for (let z = localBounds.z_min; z <= localBounds.z_max; z++)
                for (let x = localBounds.x_min; x <= localBounds.x_max; x++) {
                    let index = x * cx + y * cy + z * cz;
                    let val = uint16View[index];
                    if ((val & FLUID_WATER_INTERACT16) !== 0) {
                        let valAbove = uint16View[index + cy];
                        if ((val & FLUID_TYPE_MASK) === FLUID_WATER_ID
                            || (valAbove & FLUID_TYPE_MASK) === FLUID_WATER_ID) {
                            let wx = x + aabb.x_min, wy = y + aabb.y_min, wz = z + aabb.z_min;

                            if (y >= 0) {
                                const qplace = this.ensurePlace();
                                if ((qplace[index] & QUEUE_INTERACT) === 0) {
                                    qplace[index] |= QUEUE_INTERACT;
                                    this.list.push(index);
                                    this.markDirty();
                                }
                            } else {
                                for (let i = 0; i < downPortals.length;i++) {
                                    if (downPortals[i].aabb.contains(wx, wy, wz)) {
                                        downPortals[i].toRegion.rev.fluid.events.pushGlobal(wx, wy, wz, FLUID_EVENT_FLAG_ABOVE);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
    }

    /**
     * @param {Function} cb. Calback arguments:
     *   - pos: Vector (mutable, can't be saved!!)
     *   - isAbove: Boolean. True if the even is caused by the change of the fluid in the block above the current block.
     */
    process(cb) {
        let {list, qplace} = this;
        const {outerSize, pos, cw} = this.fluidChunk.dataChunk;
        this.inQueue = false;
        while (list.head) {
            const v = list.shift();
            const index = v & ~FLUID_EVENT_FLAG_ABOVE;

            let tmp = index - cw;
            let x = tmp % outerSize.x;
            tmp -= x;
            tmp /= outerSize.x;
            let z = tmp % outerSize.z;
            tmp -= z;
            tmp /= outerSize.z;
            let y = tmp;

            qplace[index] &= ~QUEUE_INTERACT;

            tmp_Vector.set(x + pos.x, y + pos.y, z + pos.z);
            cb(tmp_Vector, (v & FLUID_EVENT_FLAG_ABOVE) !== 0);

            let wx = x + pos.x, wy = y + pos.y, wz = z + pos.z;
            console.log(`fluid event at ${wx}, ${wy}, ${wz}`)
            // index, wx, wy, wz
        }
    }

    dispose() {
        this.list.clear();
        this.fluidChunk.events = null;
    }
}

const tmp_Vector = new Vector();