import type { BaseBigGeometry } from "./base_big_geometry.js";
import type {BaseGeometryVao} from "./base_geometry_vao.js";
import type {TerrainSubGeometry} from "./terrain_sub_geometry.js";
import {IvanArray} from "../helpers.js";
import {SimplePool} from "../helpers/simple_pool.js";
import {BufferCopyOperation} from "vauxcel";

export const bufferCopyOpPool = new SimplePool<BufferCopyOperation>(BufferCopyOperation);

export class BigGeomBatchUpdate {
    copies = new IvanArray<TerrainSubGeometry>(); // from, to, dest
    instCount = 0;
    strideFloats: number;
    baseGeom: BaseBigGeometry;
    vao: BaseGeometryVao;
    data: Float32Array;
    copyOps = new IvanArray<BufferCopyOperation>();

    constructor(baseGeom: BaseBigGeometry) {
        this.baseGeom = baseGeom;
        this.vao = baseGeom.dynamicDraw;
        this.data = this.vao.data;
        this.strideFloats = this.baseGeom.strideFloats;
    }

    ensureSize(instances: number) {
        let sz = this.vao.size;
        if (sz >= instances) {
            return;
        }
        while (sz < instances) {
            sz *= 2;
        }
        this.vao.resize(sz);
        this.data = this.vao.data;
    }

    addArrayBuffer(ab: ArrayBuffer) {
        const f32 = new Float32Array(ab);
        this.data.set(f32, this.instCount * this.strideFloats);
        this.instCount += f32.length / this.strideFloats;
        this.vao.dataDirty = true;
    }

    reset() {
        this.instCount = 0;
        const {copies, copyOps} = this;
        for (let i = 0; i < copies.count; i++) {
            copies.arr[i].batchStatus = 0;
        }
        copies.clear();
        for (let i = 0; i < copyOps.count; i++) {
            bufferCopyOpPool.free(copyOps.arr[i]);
        }
        copyOps.clear();
    }

    flipInstCount = 0;
    flipCopyCount = 0;

    checkInvariant() {
        const {flipCopyCount, copies, flipInstCount, postFlipCopyCount} = this;
        for (let i = 0; i < copies.count; i++) {
            const copy = copies.arr[i];
            let st = 0;
            if (i >= flipCopyCount) {
                st++;
                if (i >= postFlipCopyCount) {
                    st++;
                }
            }
            if (copy.batchStatus < st) {
                console.log("WTF");
            }
            if (copy.batchStatus > st) {
                let find = -1;
                for (let j = i + 1; j < copies.count; j++) {
                    if (copies.arr[j] === copy) {
                        find = j;
                        break;
                    }
                }
                if (find < 0) {
                    console.log("WTF");
                }
            }
        }
        for (let i = flipCopyCount; i < postFlipCopyCount; i++) {
            if (!copies.arr[i]) {
                console.log("WTF2");
            } else
            if (!copies.arr[i].batchStatus) {
                console.log("WTF");
            }
        }
        let maxBatch = 0;
        const start = copies.count > flipInstCount ? flipInstCount: 0;
        for (let i = start; i < copies.count; i++) {
            const copy = copies.arr[i];
            maxBatch = Math.max(maxBatch, copy.batchStart + copy.sizeQuads);
        }
        if (maxBatch !== this.instCount) {
            console.log("InstCount balance failed");
        }
    }

    postFlipInstCount = 0;
    postFlipCopyCount = 0;
    flipStatus = 1;

    preFlip() {
        this.postFlipInstCount = this.instCount;
        this.postFlipCopyCount = this.copies.count;
        this.flipStatus = 2;

        const {flipCopyCount, copies, copyOps} = this;
        for (let i = 0; i < copyOps.count; i++) {
            bufferCopyOpPool.free(copyOps.arr[i]);
        }
        copyOps.clear();
        for (let i = 0; i < copies.count; i++) {
            const copy = copies.arr[i];
            if (copy.batchStatus > 0 && i < flipCopyCount) {
                continue;
            }
            let pos = copy.batchStart;
            for (let j = 0; j < copy.glCounts.length; j++) {
                const op = bufferCopyOpPool.alloc();
                copyOps.push(op);
                op.src = pos;
                op.dst = copy.glOffsets[j];
                op.count = copy.glCounts[j];
                pos += copy.glCounts[j];
            }
        }
    }

    flip() {
        const {flipCopyCount, copies, flipInstCount, data, strideFloats,
            postFlipInstCount, postFlipCopyCount} = this;
        // this.checkInvariant();
        for (let i = flipCopyCount; i < postFlipCopyCount; i++) {
            copies.arr[i].batchStart -= flipInstCount;
            copies.arr[i].batchStatus--;
        }
        for (let i = postFlipCopyCount; i < copies.count; i++) {
            if (copies.arr[i].batchStatus === 2) {
                copies.arr[i].batchStart -= flipInstCount;
                copies.arr[i].batchStatus--;
            }
        }
        if (flipInstCount === 0) {
            this.flipCopyCount = postFlipCopyCount;
            this.flipInstCount = postFlipInstCount;
            this.postFlipInstCount = this.instCount;
            this.postFlipCopyCount = this.copies.count;
            this.flipStatus = 1;
            // this.checkInvariant();
            return;
        }
        copies.shiftCount(flipCopyCount);
        this.flipCopyCount = postFlipCopyCount - flipCopyCount;

        data.copyWithin(0, flipInstCount * strideFloats, this.instCount * strideFloats);
        this.instCount -= flipInstCount;
        this.flipInstCount = postFlipInstCount - flipInstCount;

        this.postFlipInstCount = this.instCount;
        this.postFlipCopyCount = this.copies.count;
        this.flipStatus = 1;
        // this.checkInvariant();
        this.updDynamic();
    }

    updDynamic() {
        this.vao.buffer.update(this.data.slice(0, this.instCount * this.strideFloats));
        this.vao.dataDirty = false;
    }
}
