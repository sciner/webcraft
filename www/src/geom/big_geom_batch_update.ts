import type { BaseBigGeometry } from "./base_big_geometry";
import type {BaseGeometryVao} from "./base_geometry_vao";
import type {TerrainSubGeometry} from "./terrain_sub_geometry";
import {IvanArray} from "../helpers.js";
import {GL_BUFFER_LOCATION} from "./base_geometry_vao.js";

export interface IGeomCopyOperation {
    batchStart: number;
    glOffsets: number[];
    glCounts: number[];
    copyId: number;
}

export class BigGeomBatchUpdate {
    copies = new IvanArray<TerrainSubGeometry>(); // from, to, dest
    instCount = 0;
    strideFloats: number;
    baseGeom: BaseBigGeometry;
    vao: BaseGeometryVao;
    data: Float32Array;

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
    }

    reset() {
        this.instCount = 0;
        const {copies} = this;
        for (let i = 0; i < copies.count; i++) {
            copies.arr[i].isDynamic = false;
        }
        copies.count = 0;
    }

    flipInstCount = 0;
    flipCopyCount = 0;

    checkInvariant() {
        const {flipCopyCount, copies, flipInstCount, data, strideFloats} = this;
        for (let i = 0; i < flipCopyCount; i++) {
            const copy = copies.arr[i];
            if (copy.isDynamic) {
                let find = -1;
                for (let j = flipCopyCount; j < copies.count; j++) {
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


    flip() {
        const {flipCopyCount, copies, flipInstCount, data, strideFloats} = this;
        //this.checkInvariant();
        for (let i = flipCopyCount; i < copies.count; i++) {
            copies.arr[i].batchStart -= flipInstCount;
            copies.arr[i].isDynamic = false;
        }
        if (flipInstCount === 0) {
            this.flipCopyCount = copies.count;
            this.flipInstCount = this.instCount;
            return;
        }
        copies.shiftCount(flipCopyCount);
        this.flipCopyCount = copies.count;

        data.copyWithin(0, flipInstCount * strideFloats, this.instCount * strideFloats);
        this.instCount -= flipInstCount;
        this.flipInstCount = this.instCount;
        //this.checkInvariant();
    }

    updDynamic() {
        this.vao.buffer.data = this.data.slice(0, this.instCount * this.strideFloats);
    }
}
