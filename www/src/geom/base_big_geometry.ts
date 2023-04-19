import {BigGeomBatchUpdate} from "./big_geom_batch_update.js";
import type {BaseBuffer} from "../renders/BaseRenderer.js";
import type WebGLRenderer from "../renders/webgl";
import type {BaseGeometryVao} from "./base_geometry_vao.js";
import {SillyGeometryVao} from "./silly_geometry_vao.js";
import {VAO_BUFFER_TYPE} from "./base_geometry_vao.js";

export interface BigGeometryOptions {
    staticSize?: number;
    dynamicSize?: number;
    useTransformFeedback?: boolean;
}

export class BaseBigGeometry {
    staticSize: number;
    dynamicSize: number;
    useTransformFeedback: boolean;

    indexData: Int32Array = null;
    indexBuffer: BaseBuffer = null;

    context: WebGLRenderer;
    gl: WebGL2RenderingContext = null;

    geomClass: new (options: any) => BaseGeometryVao;

    constructor({staticSize = 128, dynamicSize = 128, useTransformFeedback = true}: BigGeometryOptions) {
        this.staticSize = staticSize;
        this.dynamicSize = dynamicSize;
        this.useTransformFeedback = useTransformFeedback;
        this.createGeom();
    }

    strideFloats: number;
    staticDraw: BaseGeometryVao;
    dynamicDraw: BaseGeometryVao;
    sillyDraw: SillyGeometryVao;
    batch: BigGeomBatchUpdate;

    createGeom() {
        this.staticDraw = new this.geomClass({size: this.staticSize, bufferType: VAO_BUFFER_TYPE.BIG});
        this.dynamicDraw = new this.geomClass({size: this.dynamicSize, bufferType: VAO_BUFFER_TYPE.DYNAMIC});
        this.sillyDraw = new SillyGeometryVao();
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

    upload(shader) {
        const {batch, staticDraw, dynamicDraw, sillyDraw} = this;
        if (!this.context) {
            this.context = shader.context;
            // when WebGL
            this.gl = shader.context.gl;
            staticDraw.init(shader);
            dynamicDraw.init(shader);
            sillyDraw?.init(this.context);
        }
        if (batch.instCount === 0) {
            return;
        }
        if (dynamicDraw.buffer?.dirty) {
            batch.updDynamic();
        }
        if (this.useTransformFeedback) {
            batch.preFlip();
            sillyDraw.batchUpdate(batch.vao.buffer, staticDraw.buffer, batch.copyOps, staticDraw.stride);
            batch.reset();
        }
        else {
            batch.preFlip();
            staticDraw.buffer.batchUpdate(batch.vao.buffer, batch.copyOps, staticDraw.stride);
            batch.reset();
        }
        if (this.indexBuffer) {
            this.indexBuffer.bind();
        }
    }

    checkFence() {
    }

    resize(newSize) {
        this.staticSize = newSize;
        this.staticDraw.resize(newSize);
        console.debug(`multigeometry resize ${newSize}`);
    }

    destroy() {
        // its shared, should never be called
        this.staticDraw.destroy();
        this.dynamicDraw.destroy();
    }
}
