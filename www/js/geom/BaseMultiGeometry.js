import GeometryTerrain from "../geometry_terrain.js";

export class BaseMultiGeometry {
    static strideFloats = 10;
    static sortAss = (a, b) => {
        return a - b;
    };

    constructor({context = null, size = 128, strideFloats = 0} = {}) {
        this.updateID = 0;
        this.uploadID = -1;
        this.strideFloats = strideFloats;
        this.stride = this.strideFloats * 4;

        this.context = context;
        this.size = size;
        this.data = new Float32Array(size * this.strideFloats);
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
                usage: 'static'
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
        const {updates} = this;
        this.buffer.bind();
        if (updates.length > 0) {
            this.optimizeUpdates();
            this.buffer.multiUpdate(updates);
            updates.length = 0;
        }
        if (this.indexBuffer) {
            this.indexBuffer.bind();
        }
    }

    resize(newSize) {
        this.size = newSize;
        this.updates.length = 0;
        this.updateID++;
        const oldData = this.data;
        this.data = new Float32Array(newSize * this.strideFloats);
        this.data.set(oldData, 0);
        if (this.buffer) {
            this.buffer.data = this.data;
        }
    }

    optimizeUpdates() {
        const {updates} = this;
        for (let i = 0; i < updates.length; i += 2) {
            updates[i] = (updates[i] << 1);
            updates[i + 1] = (updates[i + 1] << 1) + 1;
        }
        updates.sort(BaseMultiGeometry.sortAss);
        let balance = 0, j = 0;
        for (let i = 0; i < updates.length; i++) {
            if (updates[i] % 2 === 0) {
                if (balance === 0) {
                    updates[j++] = updates[i] >> 1;
                    //TODO: check previous to merge?
                }
                balance++;
            } else {
                balance--;
                if (balance === 0) {
                    updates[j++] = updates[i] >> 1;
                }
            }
        }
        updates.length = j;
    }

    updatePage(dstOffset, floatBuffer) {
        const {data} = this;
        dstOffset *= this.strideFloats;
        data.set(floatBuffer, dstOffset);
        this.updates.push(dstOffset, dstOffset + floatBuffer.length);
        this.updateID++;
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
