import { SimplePool } from "../helpers/simple_pool.js";
import type { BaseBigGeometry } from "./base_big_geometry";
import type {BaseGeometryVao} from "./base_geometry_vao";
import type {TerrainSubGeometry} from "./terrain_sub_geometry";
import {IvanArray} from "../helpers.js";
import {GL_BUFFER_LOCATION, VAO_BUFFER_TYPE} from "./base_geometry_vao";

export interface IGeomCopyOperation {
    batchStart: number;
    glOffsets: number[];
    glCounts: number[];
}

export class BigGeomBatchUpdate {
    copies = new IvanArray<TerrainSubGeometry>(); // from, to, dest
    instCount: number = 0;
    strideFloats: number;
    baseGeom: BaseBigGeometry;
    vao: BaseGeometryVao;
    data: Float32Array;

    constructor(baseGeom: BaseBigGeometry) {
        this.baseGeom = baseGeom;
        this.vao = baseGeom.dynamicDraw;
        this.data = this.vao.data;
        this.strideFloats = this.baseGeom.staticDraw.strideFloats;
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
            copies[i].batchStart = -1;
            copies[i] = null;
        }
        copies.count = 0;
    }

    flipInstCount: number = 0;
    flipCopyCount: number = 0;

    flip() {
        const {flipCopyCount, copies, flipInstCount, data, strideFloats} = this;
        if (flipCopyCount === 0) {
            this.flipCopyCount = copies.count;
            this.flipInstCount = this.instCount;
            return;
        }
        for (let i = 0; i < flipCopyCount; i++) {
            copies[i].batchPos = -1;
        }
        for (let i = flipCopyCount; i < copies.count; i++) {
            const copy = copies[i - flipCopyCount] = copies[i];
            copy.batchPos -= flipInstCount;
        }
        copies.decCount(flipCopyCount);
        this.flipCopyCount = copies.count;

        data.copyWithin(0, flipInstCount * strideFloats, this.instCount * strideFloats);
        this.instCount -= flipInstCount;
        this.flipInstCount = this.instCount;
    }

    bindDynamic(loc = GL_BUFFER_LOCATION.ARRAY_BUFFER) {
        this.vao.data = this.data.slice(0, this.instCount * this.strideFloats);
        this.vao.bindForUpload(loc);
    }
}