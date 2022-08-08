import GeometryTerrain from "../geometry_terrain.js";

export class TerrainMultiGeometry {
    static strideFloats = 16;
    static sortAss = (a, b) => {
        return a - b;
    };

    constructor({context = null, size = 128} = {}) {
        this.updateID = 0;
        this.uploadID = -1;
        this.strideFloats = TerrainMultiGeometry.strideFloats;
        this.stride = this.strideFloats * 4;

        this.context = context;
        this.size = size;
        this.data = new Float32Array(size * this.strideFloats);
        /**
         *
         * @type {BaseBuffer}
         */
        this.buffer = null;
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
    }

    createVao() {
        const {attribs, gl, stride} = this;
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        gl.enableVertexAttribArray(attribs.a_position);
        gl.enableVertexAttribArray(attribs.a_axisX);
        gl.enableVertexAttribArray(attribs.a_axisY);
        gl.enableVertexAttribArray(attribs.a_uvCenter);
        gl.enableVertexAttribArray(attribs.a_uvSize);
        gl.enableVertexAttribArray(attribs.a_color);
        gl.enableVertexAttribArray(attribs.a_flags);
        gl.enableVertexAttribArray(attribs.a_chunkId);

        gl.enableVertexAttribArray(attribs.a_quad);

        this.buffer.bind();

        gl.vertexAttribPointer(attribs.a_position, 3, gl.FLOAT, false, stride, 0);
        gl.vertexAttribPointer(attribs.a_axisX, 3, gl.FLOAT, false, stride, 3 * 4);
        gl.vertexAttribPointer(attribs.a_axisY, 3, gl.FLOAT, false, stride, 6 * 4);
        gl.vertexAttribPointer(attribs.a_uvCenter, 2, gl.FLOAT, false, stride, 9 * 4);
        gl.vertexAttribPointer(attribs.a_uvSize, 2, gl.FLOAT, false, stride, 11 * 4);
        gl.vertexAttribIPointer(attribs.a_color, 1, gl.UNSIGNED_INT, stride, 13 * 4);
        gl.vertexAttribPointer(attribs.a_flags, 1, gl.FLOAT, false, stride, 14 * 4);
        gl.vertexAttribPointer(attribs.a_chunkId, 1, gl.FLOAT, false, stride, 15 * 4);

        gl.vertexAttribDivisor(attribs.a_position, 1);
        gl.vertexAttribDivisor(attribs.a_axisX, 1);
        gl.vertexAttribDivisor(attribs.a_axisY, 1);
        gl.vertexAttribDivisor(attribs.a_uvCenter, 1);
        gl.vertexAttribDivisor(attribs.a_uvSize, 1);
        gl.vertexAttribDivisor(attribs.a_color, 1);
        gl.vertexAttribDivisor(attribs.a_flags, 1);
        gl.vertexAttribDivisor(attribs.a_chunkId, 1);

        this.quad.bind();

        gl.vertexAttribPointer(attribs.a_quad, 2, gl.FLOAT, false, 2 * 4, 0);
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
            this.quad = GeometryTerrain.bindQuad(this.context, true);
            this.buffers = [
                this.buffer,
                this.quad
            ];
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
    }

    resize(newSize) {
        this.size = newSize;
        this.updates.length = 0;
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
        updates.sort(TerrainMultiGeometry.sortAss);
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
