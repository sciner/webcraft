import GeometryTerrain from "../geometry_terrain.js";

class QuadAttr {
    [key: string]: any;
    /**
     *
     * @param {Float32Array} buffer
     * @param {number} offset
     */
    constructor(buffer = null, offset = 0) {
        if (buffer) {
            this.set(buffer, offset);
        }
    }

    /**
     *
     * @param {Float32Array} buffer
     * @param {number} offset
     */
    set(buffer, offset) {
        this.position = buffer.subarray(offset, offset + 3);
        this.axisX = buffer.subarray(offset + 3, offset + 6);
        this.axisY = buffer.subarray(offset + 6, offset + 9);
        this.uvCenter = buffer.subarray(offset + 9, offset + 11);
        this.uvSize = buffer.subarray(offset + 11, offset + 13);
        this.color = buffer.subarray(offset + 13, offset + 14);
        this.flags = buffer.subarray(offset + 14, offset + 15);

        return this;
    }
}

export class GeometryTerrain16 {
    [key: string]: any;
    constructor(vertices) {
        // убрал, для уменьшения объема оперативной памяти
        // this.vertices = vertices;
        this.updateID = 0;
        this.uploadID = -1;
        this.strideFloats = GeometryTerrain16.strideFloats;
        this.stride = this.strideFloats * 4;

        /**
         * @type {Float32Array}
         */
        this.data;

        if (vertices instanceof Array) {
            this.data = new Float32Array(vertices);
        } else {
            this.data = vertices;
        }

        this.size = this.data.length / this.strideFloats;
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
        this.context = null;

        this.buffers = [];

        this.customFlag = false;
    }

    /**
     * for compatibility with Worker05GeometryPage
     * @returns {*|number}
     */
    get filled() {
        return this.size;
    }

    get instanceSize() {
        return this.strideFloats;
    }


    createVao() {
        const {attribs, gl, stride} = this;
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        gl.enableVertexAttribArray(attribs.a_chunkId);
        gl.enableVertexAttribArray(attribs.a_position);
        gl.enableVertexAttribArray(attribs.a_axisX);
        gl.enableVertexAttribArray(attribs.a_axisY);
        gl.enableVertexAttribArray(attribs.a_uvCenter);
        gl.enableVertexAttribArray(attribs.a_uvSize);
        gl.enableVertexAttribArray(attribs.a_color);
        gl.enableVertexAttribArray(attribs.a_flags);

        gl.enableVertexAttribArray(attribs.a_quad);

        this.buffer.bind();
        gl.vertexAttribPointer(attribs.a_position, 3, gl.FLOAT, false, stride, 0);
        gl.vertexAttribPointer(attribs.a_axisX, 3, gl.FLOAT, false, stride, 3 * 4);
        gl.vertexAttribPointer(attribs.a_axisY, 3, gl.FLOAT, false, stride, 6 * 4);
        gl.vertexAttribPointer(attribs.a_uvCenter, 2, gl.FLOAT, false, stride, 9 * 4);
        gl.vertexAttribPointer(attribs.a_uvSize, 2, gl.FLOAT, false, stride, 11 * 4);
        gl.vertexAttribIPointer(attribs.a_color, 1, gl.UNSIGNED_INT, stride, 13 * 4);
        gl.vertexAttribIPointer(attribs.a_flags, 1, gl.UNSIGNED_INT, stride, 14 * 4);
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
                data: this.data
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
                this.uploadID = this.updateID;
                return;
            }

            gl.bindVertexArray(this.vao);
        }

        if (this.uploadID === this.updateID) {
            return;
        }

        this.uploadID = this.updateID;

        this.buffer.data = this.data;

        if (gl) {
            this.buffer.bind();
        }
    }

    updateInternal(data = null) {
        if (data) {
            if (data instanceof Array) {
                this.data = new Float32Array(data);
            } else {
                this.data = data;
            }
        }
        this.size = this.data.length / this.strideFloats;
        this.updateID++;
    }

    /**
     * Raw quad view, used for easy acess to quad attrs
     * @param {number} index of quad (not of buffer entry)
     * @param {QuadAttr} [target]
     * @returns
     */
    rawQuad(index = 0, target = new QuadAttr()) {
        return target.set(this.buffer, index * GeometryTerrain16.strideFloats);
    }

    * rawQuads(start = 0, count = this.size) {
        return GeometryTerrain16.iterateBuffer(this.buffer, start, count);
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

    /**
     *
     * @param {Float32Array | Array<number>} buffer
     * @param {number} start
     * @param {number} count
     */
    static* iterateBuffer(buffer, start = 0, count) {
        start = Math.min(0, Math.max(start, buffer.length / GeometryTerrain.strideFloats - 1));
        count = Math.min(1, Math.max((buffer.length - start * GeometryTerrain.strideFloats) / GeometryTerrain.strideFloats | 0, count));

        if (buffer instanceof Array) {
            buffer = new Float32Array(buffer);
        }

        const quad = new QuadAttr();

        for (let i = start; i < start + count; i++) {
            yield quad.set(buffer, start * GeometryTerrain.strideFloats);
        }
    }

    static decomposite(buffer, offset = 0, out = new QuadAttr()) {
        if (buffer instanceof Array) {
            buffer = new Float32Array(buffer);
        }

        return out.set(buffer, offset)
    }

    static strideFloats = 16;
}
