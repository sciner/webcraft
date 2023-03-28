import GeometryTerrain from "../geometry_terrain.js";
import type {BigGeomBatchUpdate} from "./big_geom_batch_update.js";
import type {IChunkVertexBuffer} from "../chunk";

export class BaseMultiGeometry {
    [key: string]: any;
    static strideFloats = 10;
    static sortAss = (a, b) => {
        return a - b;
    };

    batch: BigGeomBatchUpdate = null;

    constructor({context = null, size = 128, strideFloats = 0} = {}) {
        this.updateID = 0;
        this.uploadID = -1;
        this.strideFloats = strideFloats;
        this.stride = this.strideFloats * 4;

        this.context = context;
        this.size = size;
        this.indexData = null;
        /**
         *
         * @type {BaseBuffer}
         */
        this.buffer = null;
        this.indexBuffer = null;
        /**
         *
         * @type {BaseBuffer}
         */
        this.quad = null;
        this.vao = null;
        /**
         *
         * @type {BaseRenderer}
         */
        this.buffers = [];

        this.updates = [];

        this.hasInstance = false;

    }

    createVao() {
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
                data: this.data,
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
                this.updates.length = 0;
                this.uploadID = this.updateID;
                return;
            }

            gl.bindVertexArray(this.vao);
        }

        // multi upload!
        if (this.uploadID === this.updateID) {
            return;
        }
        this.uploadID = this.updateID;
        this.buffer.bind();
        if (this.batch.pos > 0) {
            const batchBuf = this.batch.getBuf(this.context);
            batchBuf.updatePartial(this.batch.pos * this.stride);
            this.buffer.batchUpdate(batchBuf, this.batch.copies);
            this.batch.reset();
        }
        if (this.indexBuffer) {
            this.indexBuffer.bind();
        }
    }

    resize(newSize) {
        this.size = newSize;
        this.updateID++;
        if (this.buffer) {
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
