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
    data: Float32Array = null;
    buffer: BaseBuffer = null;
    copies: Array<GeomCopyOperation> = []; // from, to, dest
    heuristicSize: number = 0;
    pos: number = 0;
    copyPos: number = 0;
    strideFloats: number;

    constructor(strideFloats, heuristicSize = (1 << 13)) {
        this.heuristicSize = heuristicSize;
        this.strideFloats = strideFloats;
        this.ensureSize(heuristicSize);
    }

    ensureSize(instances: number) {
        if (this.data && instances * this.strideFloats <= this.data.length) {
            return;
        }
        const oldData = this.data;
        this.data = new Float32Array(instances * this.strideFloats);
        if (oldData) {
            this.data.set(oldData, 0);
        }
        if (this.buffer) {
            this.buffer.data = this.data;
        }
    }

    addArrayBuffer(ab: ArrayBuffer) {
        const f32 = new Float32Array(ab);
        this.data.set(f32, this.pos * this.strideFloats);
        this.pos += f32.length / this.strideFloats;
    }

    addCopy(srcInstance, destInstance, size: number) {
        let op = GeomCopyOperation.pool.alloc();
        op.srcInstance = srcInstance;
        op.destInstance = destInstance;
        op.size = size;
        this.copies[this.copyPos++] = op;
    }

    reset() {
        this.pos = 0;
        const {copies, copyPos} = this;
        this.copyPos = 0;
        for (let i = 0; i < copyPos; i++) {
            GeomCopyOperation.pool.free(copies[i]);
            copies[i] = null;
        }
    }

    getBuf(context: BaseRenderer) {
        if (!this.buffer) {
            this.buffer = context.createBuffer({usage: 'dynamic', data: this.data});
        }
        if (this.pos > 0) {
            this.buffer.dirty = true;
        }
        return this.buffer;
    }
}