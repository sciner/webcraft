import {BigGeomBatchUpdate} from "./big_geom_batch_update.js";
import type {BaseBuffer} from "../renders/BaseRenderer.js";
import type WebGLRenderer from "../renders/webgl";
import type {BaseGeometryVao} from "./base_geometry_vao.js";
import {GL_BUFFER_LOCATION} from "./base_geometry_vao.js";
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

    geomClass: new (options:any) => BaseGeometryVao;

    constructor({staticSize = 128, dynamicSize = 128, useDoubleBuffer = false} : BigGeometryOptions) {
        this.staticSize = staticSize;
        this.dynamicSize = dynamicSize;
        this.useDoubleBuffer = useDoubleBuffer;
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
        const {batch, staticDraw, dynamicDraw} = this;
        if (!this.context) {
            this.context = shader.context;
            // when WebGL
            this.gl = shader.context.gl;
            staticDraw.init(shader);
            dynamicDraw.init(shader);
        }

        staticDraw.bindForUpload();

        if (batch.instCount === 0) {
            return;
        }
        if (this.useDoubleBuffer) {
        } else {
            batch.updDynamic();
            staticDraw.buffer.batchUpdate(batch.vao.buffer, batch.copies, staticDraw.stride);
            batch.reset();
        }
        if (this.indexBuffer) {
            this.indexBuffer.bind();
        }
        if (staticDraw.buffer.bigResize) {
            staticDraw.buffer.bigResize = false;
            // shader.bind();
            staticDraw.attribBufferPointers();
        }
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
