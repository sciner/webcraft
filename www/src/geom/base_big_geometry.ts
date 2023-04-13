import {BigGeomBatchUpdate} from "./big_geom_batch_update.js";
import type {BaseBuffer} from "../renders/BaseRenderer.js";
import type WebGLRenderer from "../renders/webgl";
import type {BaseGeometryVao} from "./base_geometry_vao.js";
import {VAO_BUFFER_TYPE} from "./base_geometry_vao.js";

export interface BigGeometryOptions {
    staticSize?: number;
    dynamicSize?: number;
    useDoubleBuffer?: boolean;
}

export class BaseBigGeometry {
    staticSize: number;
    dynamicSize: number;

    indexData: Int32Array = null;
    indexBuffer: BaseBuffer = null;

    context: WebGLRenderer;
    gl: WebGL2RenderingContext = null;
    useDoubleBuffer = false;

    geomClass: new (options: any) => BaseGeometryVao;

    constructor({staticSize = 128, dynamicSize = 128, useDoubleBuffer = true}: BigGeometryOptions) {
        this.staticSize = staticSize;
        this.dynamicSize = dynamicSize;
        this.useDoubleBuffer = useDoubleBuffer;
        this.createGeom();
    }

    strideFloats: number;
    staticDraw: BaseGeometryVao;
    staticCopy: BaseGeometryVao;
    dynamicDraw: BaseGeometryVao;
    batch: BigGeomBatchUpdate;

    createGeom() {
        this.staticDraw = new this.geomClass({size: this.staticSize, bufferType: VAO_BUFFER_TYPE.BIG});
        if (this.useDoubleBuffer) {
            this.staticCopy = new this.geomClass({size: this.staticSize, bufferType: VAO_BUFFER_TYPE.BIG});
        }
        this.dynamicDraw = new this.geomClass({size: this.dynamicSize, bufferType: VAO_BUFFER_TYPE.DYNAMIC});
        this.strideFloats = this.staticDraw.strideFloats;
        this.batch = new BigGeomBatchUpdate(this);
    }

    bind() {
        const geom = this.staticDraw;
        geom.bindForDraw();
        if (geom.hasInstance && !this.context.multidrawBaseExt) {
            geom.buffer.bind();
        }
    }

    flipCount = 0;

    flip() {
        this.flipCount++;
        // if (!this.indexBuffer) {
        //     console.log(`FLIP ${this.flipCount}`);
        // }
        const t = this.staticDraw;
        this.staticDraw = this.staticCopy;
        this.staticCopy = t;
        this.batch.flip();

        if (this.staticCopy.size < this.staticSize) {
            this.staticCopy?.resize(this.staticSize);
        }
    }

    upload(shader) {
        const {batch, staticDraw, staticCopy, dynamicDraw} = this;
        if (!this.context) {
            this.context = shader.context;
            // when WebGL
            this.gl = shader.context.gl;
            staticDraw.init(shader);
            staticCopy?.init(shader);
            dynamicDraw.init(shader);
        }
        if (batch.instCount === 0) {
            return;
        }
        if (dynamicDraw.buffer?.dirty) {
            batch.updDynamic();
        }
        if (this.useDoubleBuffer) {
            if (staticCopy.isSynced()) {
                if (staticCopy.copyFlag) {
                    staticCopy.copyFlag = false;
                    // let tempCnt = batch.copies.count;
                    // batch.copies.count = batch.postFlipInstCount;
                    staticCopy.buffer.batchUpdate(batch.vao.copyBuffer, batch.copies, staticDraw.stride);
                    // batch.copies.count = tempCnt;
                    this.flip();
                } else {
                    staticCopy.copyFlag = true;
                    batch.preFlip();
                    staticCopy.checkFence(true);
                }
            }
        } else {
            staticDraw.buffer.batchUpdate(batch.vao.buffer, batch.copies, staticDraw.stride);
            batch.reset();
        }
        if (this.indexBuffer) {
            this.indexBuffer.bind();
        }
    }

    checkFence() {
        if (!this.useDoubleBuffer) {
            return;
        }
        this.staticDraw.checkFence();
        this.staticCopy.checkFence();
    }

    resize(newSize) {
        this.staticSize = newSize;
        if (!this.staticCopy?.copyFlag) {
            this.staticCopy.resize(newSize);
        }
        console.debug(`multigeometry resize ${newSize}`);
    }

    destroy() {
        // its shared, should never be called
        this.staticDraw.destroy();
        this.dynamicDraw.destroy();
    }
}
