import GeometryTerrain from "../geometry_terrain.js";
import type {BigGeomBatchUpdate} from "./big_geom_batch_update.js";
import type {BaseBuffer} from "../renders/BaseRenderer.js";
import type WebGLRenderer from "../renders/webgl";

export class BaseBigGeometry {
    static strideFloats = 10;
    static sortAss = (a, b) => {
        return a - b;
    };

    batch: BigGeomBatchUpdate = null;

    updateID = 0;
    uploadID = -1;
    strideFloats: number;
    stride: number;
    context: WebGLRenderer;
    size: number;
    indexData: Int32Array;
    buffer: BaseBuffer = null;
    indexBuffer: BaseBuffer = null;
    quad: BaseBuffer = null;
    vao: WebGLVertexArrayObject = null;
    buffers: BaseBuffer[] = [];
    hasInstance = false;
    gl: WebGL2RenderingContext;
    attribs: any;

    constructor({context = null, size = 128, strideFloats = 0} = {}) {
        this.strideFloats = strideFloats;
        this.stride = this.strideFloats * 4;
        this.context = context;
        this.size = size;
    }

    createVao() {
        // override!
    }
    attribBufferPointers() {
        // override!
    }

    bind(shader) {
        if (shader) {
            this.attribs = shader;
            this.context = shader.context;
            // when WebGL
            this.gl = shader.context.gl;
        }

        if (!this.buffer) {
            this.buffer = this.context.createBuffer({
                usage: 'static',
                bigLength: this.size * this.stride,
            });
            // this.data = null;

            if (this.hasInstance) {
                this.quad = GeometryTerrain.bindQuad(this.context, true);
                this.buffers = [
                    this.buffer,
                    this.quad
                ];
            } else {
                //TODO
            }
        }


        const {gl} = this;

        if (gl) {
            if (!this.vao) {
                this.createVao();
                this.uploadID = this.updateID;
                return;
            }

            gl.bindVertexArray(this.vao);
        }

        // multi upload!
        if (this.uploadID === this.updateID) {
            if (this.hasInstance && !this.context.multidrawBaseExt) {
                this.buffer.bind();
            }
            return;
        }
        this.uploadID = this.updateID;
        if (this.batch.copyPos > 0) {
            const batchBuf = this.batch.getBuf(this.context);
            batchBuf.updatePartial(this.batch.pos * this.strideFloats);
            this.buffer.batchUpdate(batchBuf, this.batch.copies, this.batch.copyPos, this.stride);
            this.batch.reset();
        } else {
            this.buffer.bind();
        }
        if (this.buffer.bigResize) {
            this.buffer.bigResize = false;
            this.attribBufferPointers();
        }
        if (this.indexBuffer) {
            this.indexBuffer.bind();
        }
    }

    resize(newSize) {
        this.size = newSize;
        this.updateID++;
        if (this.buffer) {
            this.buffer.dirty = true;
            this.buffer.bigLength = this.size * this.stride;
        }
        console.debug(`multigeometry resize ${newSize}`);
    }

    destroy() {
        // we not destroy it, it shared
        this.quad = null;

        if (this.buffer) {
            this.buffer.destroy();
            this.buffer = null;
        }

        if (this.vao) {
            this.gl.deleteVertexArray(this.vao);
            this.vao = null;
        }
    }
}
