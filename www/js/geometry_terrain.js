import {IndexedColor} from './helpers.js';

class QuadAttr {
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

export default class GeometryTerrain {
    constructor(vertices, chunkId) {
        // убрал, для уменьшения объема оперативной памяти
        // this.vertices = vertices;
        this.updateID = 0;
        this.uploadID = -1;
        this.strideFloats = GeometryTerrain.strideFloats;
        this.stride = this.strideFloats * 4;

        /**
         * @type {Float32Array}
         */
        this.data;
        /**
         * @type {Uint32Array}
         */
        this.uint32Data;

        this.setVertices(vertices);

        this.size = this.data.length / this.strideFloats;
        this.chunkIds = null;

        this.setChunkId(chunkId === undefined ? -1: chunkId);
        /**
         *
         * @type {BaseBuffer}
         */
        this.buffer = null;
        this.bufferChunkIds = null;
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

    setVertices(vertices) {
        if (vertices instanceof ArrayBuffer) {
            this.data = new Float32Array(vertices);
            this.uint32Data = new Uint32Array(this.data.buffer);
        } else if (vertices instanceof Float32Array) {
            this.data = vertices;
            this.uint32Data = new Uint32Array(this.data.buffer);
        } else {
            this.data = new Float32Array(vertices);
            this.uint32Data = new Uint32Array(this.data.buffer);
            for (let i = 0; i < vertices.length; i += this.strideFloats) {
                this.uint32Data[i + 13] = vertices[i + 13];
                this.uint32Data[i + 14] = vertices[i + 14];
            }
        }
    }

    /**
     * for particles, change particular quad by offset
     * @param vertices Array
     * @param offset offset in floats
     */
    changeQuad(offsetFloat, vertices) {
        const {data, uint32Data, strideFloats} = this;

        for (let i = 0; i < strideFloats; i++) {
            data[offsetFloat + i] = vertices[i];
        }
        uint32Data[offsetFloat + 13] = vertices[13];
        uint32Data[offsetFloat + 14] = vertices[14];
    }

    /**
     * Change flags attribute in buffer
     * @param {number} flag
     * @param {'or' | 'and' | 'replace'} mode
     */
    changeFlags(flag, mode = 'or') {
        let operation = (bufferFlag) => bufferFlag | flag;

        if (mode === 'and')
            operation = (bufferFlag) => bufferFlag & flag;
        else if (mode === 'replace')
            operation = (bufferFlag) => flag;

        // flag located by 14 offset
        for (let i = 0; i < this.data.length; i += this.strideFloats) {
            this.uint32Data[i + 14] = operation(this.uint32Data[i + 14]);
        }

        this.updateID++;
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

        this.bufferChunkIds.bind();
        gl.vertexAttribPointer(attribs.a_chunkId, 1, gl.FLOAT, false, 4, 0);
        gl.vertexAttribDivisor(attribs.a_chunkId, 1);

        this.buffer.bind();
        gl.vertexAttribPointer(attribs.a_position, 3, gl.FLOAT, false, stride, 0);
        gl.vertexAttribPointer(attribs.a_axisX, 3, gl.FLOAT, false, stride, 3 * 4);
        gl.vertexAttribPointer(attribs.a_axisY, 3, gl.FLOAT, false, stride, 6 * 4);
        gl.vertexAttribPointer(attribs.a_uvCenter, 2, gl.FLOAT, false, stride, 9 * 4);
        gl.vertexAttribPointer(attribs.a_uvSize, 2, gl.FLOAT, false, stride, 11 * 4);
        gl.vertexAttribIPointer(attribs.a_color, 1, gl.UNSIGNED_INT, stride, 13 * 4);
        gl.vertexAttribIPointer(attribs.a_flags, 1, gl.UNSIGNED_INT, stride, 14 * 4);

        gl.vertexAttribDivisor(attribs.a_position, 1);
        gl.vertexAttribDivisor(attribs.a_axisX, 1);
        gl.vertexAttribDivisor(attribs.a_axisY, 1);
        gl.vertexAttribDivisor(attribs.a_uvCenter, 1);
        gl.vertexAttribDivisor(attribs.a_uvSize, 1);
        gl.vertexAttribDivisor(attribs.a_color, 1);
        gl.vertexAttribDivisor(attribs.a_flags, 1);

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
            this.bufferChunkIds = this.context.createBuffer({
                data: this.chunkIds
            });
            // this.data = null;
            this.quad = GeometryTerrain.bindQuad(this.context, true);
            this.buffers = [
                this.buffer,
                this.bufferChunkIds,
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
        this.bufferChunkIds.data = this.chunkIds;

        if (gl) {
            this.buffer.bind();
            this.bufferChunkIds.bind();
        }
    }

    setChunkId(chunkId) {
        if (!this.chunkIds || this.chunkIds.length !== this.size) {
            this.chunkIds = new Float32Array(this.size);
        }
        const {chunkIds} = this;
        if (chunkId !== undefined) {
            for (let i = 0; i < chunkIds.length; i++) {
                chunkIds[i] = chunkId;
            }
        }
    }

    updateInternal(data = null, chunkId = -1) {
        if (data) {
            if (data instanceof Array) {
                this.data = new Float32Array(data);
            } else {
                this.data = data;
            }
        }
        this.size = this.data.length / this.strideFloats;
        this.updateID++;

        this.setChunkId(chunkId);
    }

    /**
     * Raw quad view, used for easy acess to quad attrs
     * @param {number} index of quad (not of buffer entry)
     * @param {QuadAttr} [target]
     * @returns
     */
    rawQuad(index = 0, target = new QuadAttr()) {
        return target.set(this.data, index * GeometryTerrain.strideFloats);
    }

    * rawQuads(start = 0, count = this.size) {
        return GeometryTerrain.iterateBuffer(this.data, start, count);
    }

    destroy() {
        // we not destroy it, it shared
        this.quad = null;

        if (this.buffer) {
            this.buffer.destroy();
            this.buffer = null;
            this.bufferChunkIds.destroy();
            this.bufferChunkIds = null;
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

    static quadBuf = null;

    /**
     *
     * @param {BaseRenderer} context
     * @param noBind - only create, no bind
     * @return {BaseBuffer}
     */
    static bindQuad(context, noBind = false) {
        if (GeometryTerrain.quadBuf) {
            GeometryTerrain.quadBuf.bind();
            return GeometryTerrain.quadBuf;
        }

        const quadBuf = GeometryTerrain.quadBuf = context.createBuffer({
            data: new Float32Array([
                -.5, -.5,
                .5, -.5,
                .5, .5,
                -.5, -.5,
                .5, .5,
                -.5, .5]
            ),
            usage: 'static'
        });

        !noBind && quadBuf.bind();
        return quadBuf;
    }

    static convertFrom12(vertices) {
        const oldStride = 12;
        const len = vertices.length / oldStride / 6;
        const newArr = new Float32Array(len * GeometryTerrain.strideFloats);
        const uint32Data = new Float32Array(newArr.buffer);
        let k = 0;
        for (let j = 0; j < vertices.length; j += oldStride * 6) {
            let du = 0, dv = 0, dd = 0, d0 = 0;
            for (let i = oldStride; i < oldStride * 6; i += oldStride) {
                if (vertices[j + i + 3] !== vertices[j + 3]) {
                    if (vertices[j + i + 4] !== vertices[j + 4]) {
                        dd = i;
                    } else {
                        du = i;
                    }
                } else {
                    if (vertices[j + i + 4] !== vertices[j + 4]) {
                        dv = i;
                    }
                }
            }
            // position
            newArr[k++] = (vertices[j + dd] + vertices[j + d0]) * 0.5;
            newArr[k++] = (vertices[j + dd + 1] + vertices[j + d0 + 1]) * 0.5;
            newArr[k++] = (vertices[j + dd + 2] + vertices[j + d0 + 2]) * 0.5;
            // axisX
            const ux = (vertices[j + du] - vertices[j + d0]);
            const uy = (vertices[j + du + 1] - vertices[j + d0 + 1]);
            const uz = (vertices[j + du + 2] - vertices[j + d0 + 2]);
            // axisY
            let vx = (vertices[j + dv] - vertices[j + d0]);
            let vy = (vertices[j + dv + 1] - vertices[j + d0 + 1]);
            let vz = (vertices[j + dv + 2] - vertices[j + d0 + 2]);

            const nx = uy * vz - vy * uz;
            const ny = uz * vx - vz * ux;
            const nz = ux * vy - vx * uy;

            const dot = nx * vertices[j + 9] + ny * vertices[j + 11] + nz * vertices[j + 10];
            // if (dot < 0) {
            //     vx = -vx;
            //     vy = -vy;
            //     vz = -vz;
            //     let tmp = d0; d0 = dv; dv = tmp;
            //     tmp = du; du = dd; dd = tmp;
            // }
            newArr[k++] = ux;
            newArr[k++] = uy;
            newArr[k++] = uz;

            newArr[k++] = vx;
            newArr[k++] = vy;
            newArr[k++] = vz;

            // uvCenter
            newArr[k++] = (vertices[j + dd + 3] + vertices[j + d0 + 3]) * 0.5;
            newArr[k++] = (vertices[j + dd + 4] + vertices[j + d0 + 4]) * 0.5;
            // uvSize2
            newArr[k++] = (vertices[j + dd + 3] - vertices[j + d0 + 3]);
            newArr[k++] = (vertices[j + dd + 4] - vertices[j + d0 + 4]);
            // color
            uint32Data[k++] = IndexedColor.packArg(vertices[j + 5], vertices[j + 6] , vertices[j + 7]);
            // flags
            newArr[k++] = Math.abs(dot) < 1e-6 ? 1 : 0;
        }
        return newArr;
    }

    static strideFloats = 15;
}
