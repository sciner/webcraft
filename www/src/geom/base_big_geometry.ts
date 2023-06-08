import {BigGeomBatchUpdate} from "./big_geom_batch_update.js";
import type WebGLRenderer from "../renders/webgl";
import type {BaseGeometryVao} from "./base_geometry_vao.js";
import {VAO_BUFFER_TYPE} from "./base_geometry_vao.js";
import type {Buffer} from 'vauxcel';

export interface BigGeometryOptions {
    staticSize?: number;
    dynamicSize?: number;
    useTransformFeedback?: boolean;
}

export class BaseBigGeometry {
    staticCopy: any;
    staticSize: number;
    dynamicSize: number;
    useTransformFeedback: boolean;

    indexData: Int32Array = null;
    indexBuffer: Buffer = null;

    context: WebGLRenderer;

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
    batch: BigGeomBatchUpdate;

    createGeom() {
        this.staticDraw = new this.geomClass({size: this.staticSize, bufferType: VAO_BUFFER_TYPE.BIG});
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

    upload(shader) {

        const { batch, staticDraw, dynamicDraw} = this;

        if (!this.context) {
            this.context = shader.context;
            // when WebGL
            staticDraw.init();
            dynamicDraw.init();
        }
        const { pixiRender } = this.context;

        this.staticDraw.validateResize(pixiRender);

        if (batch.instCount === 0) {
            return;
        }
        if (dynamicDraw.buffer?.dirty) {
            batch.updDynamic();
        }

        //TODO: batch copy here
        // if (this.useTransformFeedback) {
        //     batch.preFlip();
        //     sillyDraw.batchUpdate(batch.vao.buffer, staticDraw.buffer, batch.copyOps, staticDraw.stride);
        //     batch.reset();
        // }
        // else {
        //     batch.preFlip();
        //     staticDraw.buffer.batchUpdate(batch.vao.buffer, batch.copyOps, staticDraw.stride);
        //     batch.reset();
        // }
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
