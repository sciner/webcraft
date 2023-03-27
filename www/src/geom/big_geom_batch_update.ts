import type {BaseMultiGeometry} from "./BaseMultiGeometry.js";
import {SimplePool} from "../helpers/simple_pool.js";
import type {BaseBuffer} from "../renders/BaseRenderer.js";
import type BaseRenderer from "../renders/BaseRenderer.js";

export class GeomCopyOperation {
    srcInstance: number;
    destInstance: number;
    size: number;
    reset() {
        this.srcInstance = 0;
        this.destInstance = 0;
        this.size = 0;
    }

    static pool = new SimplePool(GeomCopyOperation);
}

export class BigGeomBatchUpdate {
    baseGeom: BaseMultiGeometry = null;
    data: Float32Array = null;
    buffer: BaseBuffer = null;
    copies: Array<GeomCopyOperation> = null; // from, to, dest
    maxSize: number = 0;
    pos: number = 0;

    constructor(maxSize = (1 << 18)) {
        this.maxSize = maxSize;
        this.ensureSize(maxSize);
    }

    ensureSize(instances: number) {
        const {strideFloats} = this.baseGeom;
        if (instances * strideFloats <= this.data.length) {
            return;
        }
        const oldData = this.data;
        this.data = new Float32Array(instances * strideFloats);
        if (oldData) {
            this.data.set(oldData, 0);
        }
        if (this.buffer) {
            this.buffer.data = this.data;
        }
    }

    addArrayBuffer(ab: ArrayBuffer) {
        const f32 = new Float32Array(ab);
        const {strideFloats} = this.baseGeom;
        this.data.set(f32, this.pos * strideFloats);
        this.pos += f32.length / strideFloats;
    }

    getBuf(context: BaseRenderer) {
        if (!this.buffer) {
            this.buffer = context.createBuffer({usage: 'dynamic', data: this.data});
        }
        if (this.pos > 0) {
            this.buffer.dirty = true;
        }
    }
}