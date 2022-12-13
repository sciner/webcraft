import {
    FLUID_STRIDE, FLUID_TYPE_MASK, FLUID_WATER_ID,
    FLUID_WATER_INTERACT16, fluidBlockProps, OFFSET_BLOCK_PROPS,
} from "./FluidConst.js";
import {
    BLOCK
} from "./../blocks.js";
import {SingleQueue} from "../light/MultiQueue.js";

const QUEUE_INTERACT = 1;

export class FluidChunkEvents {
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

    pushCoord(index, wx, wy, wz) {
        const { uint16View } = this.fluidChunk;
        const { cy } = this.fluidChunk.dataChunk;
        if ((uint16View[index] & FLUID_WATER_INTERACT16) !== 0) {
            const qplace = this.ensurePlace();
            if ((qplace[index] & QUEUE_INTERACT) === 0) {
                qplace[index] |= QUEUE_INTERACT;
                this.list.push(index);
                this.markDirty();
            }
        }
        if ((uint16View[index - cy] & FLUID_WATER_INTERACT16) !== 0) {
            const qplace = this.ensurePlace();
            if ((qplace[index - cy] & QUEUE_INTERACT) === 0) {
                const {facetPortals, aabb} = this.fluidChunk.dataChunk;
                wy--;
                if (wy >= aabb.y_min) {
                    qplace[index - cy] |= QUEUE_INTERACT;
                    this.list.push(index - cy);
                    this.markDirty();
                } else {
                    for (let i = 0; i < facetPortals.length; i++) {
                        const region = facetPortals[i].toRegion;
                        if (region.aabb.contains(wx, wy, wz)) {
                            region.rev.fluid.events.pushGlobal(wx, wy, wz);
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

    pushGlobal(wx, wy, wz) {
        const index = this.fluidChunk.dataChunk.indexByWorld(wx, wy, wz);
        const qplace = this.fluidChunk.ensurePlace();
        if ((qplace[index] & QUEUE_INTERACT) !== 0) {
            return;
        }
        qplace[index] |= QUEUE_INTERACT;
        this.list.push(index);
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
                                        downPortals[i].toRegion.rev.fluid.events.pushGlobal(wx, wy, wz);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
    }

    process() {
        let {list, qplace} = this;
        const {outerSize, pos, cw} = this.fluidChunk.dataChunk;
        this.inQueue = false;
        while (list.head) {
            const index = list.shift();

            let tmp = index - cw;
            let x = tmp % outerSize.x;
            tmp -= x;
            tmp /= outerSize.x;
            let z = tmp % outerSize.z;
            tmp -= z;
            tmp /= outerSize.z;
            let y = tmp;

            qplace[index] &= ~QUEUE_INTERACT;

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