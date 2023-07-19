import {IndexedColor} from '../helpers.js';
import {Buffer, Geometry, TYPES} from 'vauxcel';
import type {BaseShader} from "../renders/BaseShader.js";

export class QuadAttr {
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

export class TerrainGeometry15 extends Geometry {
    [key: string]: any;
    strideFloats: int;
    parts_counter = 0;
    constructor(vertices?) {
        super();
        this.instanceCount = 0;
        // убрал, для уменьшения объема оперативной памяти
        // this.vertices = vertices;
        this.updateID = 0;
        this.uploadID = -1;
        this.strideFloats = TerrainGeometry15.strideFloats;
        this.stride = this.strideFloats * 4;

        /**
         * @type {Float32Array}
         */
        this.data;
        /**
         * @type {Uint32Array}
         */
        this.uint32Data;

        this.dataSub = null;

        this.size = -1;
        this.chunkIds = null;
        this.setVertices(vertices || []);
        /**
         *
         * @type {BaseBuffer}
         */
        this.buffer = new Buffer(this.data, true);
        this.bufferChunkIds = new Buffer(this.chunkIds, true);
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

        /**
         * destroy after draw
         */
        this.autoDestroy = false;

        this.initGeom();
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
        const oldSize = this.size;
        this.size = vertices.length / this.strideFloats
        this.setChunkId();
        this.updateID++;
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

    initGeom() {
        const { stride } = this;
        this.addAttribute('a_chunkId', this.bufferChunkIds, 1, false, undefined, 4, 0, true);
        this.addAttribute('a_position', this.buffer, 3, false, undefined, stride, 0, true);
        this.addAttribute('a_axisX', this.buffer, 3, false, undefined, stride, 3 * 4, true);
        this.addAttribute('a_axisY', this.buffer, 3, false, undefined, stride, 6 * 4, true);
        this.addAttribute('a_uvCenter', this.buffer, 2, false, undefined, stride, 9 * 4, true);
        this.addAttribute('a_uvSize', this.buffer, 2, false, undefined, stride, 11 * 4, true);
        this.addAttribute('a_color', this.buffer, 1, false, TYPES.UNSIGNED_INT, stride, 13 * 4, true);
        this.addAttribute('a_flags', this.buffer, 1, false, TYPES.UNSIGNED_INT, stride, 14 * 4, true);
        this.addAttribute('a_quad', TerrainGeometry15.quadBuf, 2, false, undefined, 2 * 4, 0);
        this.attributes['a_chunkId'].hasSingleValue = true;
    }

    bind(shader: BaseShader) {
        if (shader) {
            this.context = shader.context;
        }
        if (this.uploadID !== this.updateID) {
            this.uploadID = this.updateID;
            this.buffer.update(this.dataSub || this.data);
        }
        this.context.pixiRender.geometry.bind(this);
    }

    setChunkId() {
        if (this.chunkIds && this.chunkIds.length === this.size) {
            return;
        }
        this.chunkIds = new Float32Array(this.size);
        const {chunkIds} = this;
        for (let i = 0; i < chunkIds.length; i++) {
            chunkIds[i] = -1;
        }
        this.bufferChunkIds?.update(chunkIds);
    }

    updateInternal(data = null, instanceCount = 0) {
        const STRIDE_FLOATS = this.strideFloats;

        if (data && data !== this.data) {
            if (data instanceof Array) {
                this.data = new Float32Array(data);
            } else {
                this.data = data;
            }
            this.size = this.data.length / STRIDE_FLOATS;
            this.dataSub = null;

            this.setChunkId();
        }
        if (instanceCount > 0) {
            const oldInstances = this.dataSub ? this.dataSub.length / STRIDE_FLOATS : this.size;
            if (oldInstances < instanceCount || oldInstances - 10 > instanceCount * 2)
            {
                const newInstances = Math.min(this.size, instanceCount + 10);

                if (newInstances === this.size) {
                    this.dataSub = null;
                } else {
                    this.dataSub = this.data.subarray(0, newInstances * STRIDE_FLOATS);
                }
            }
        }
        this.instanceCount = instanceCount;
        this.updateID++;
    }

    /**
     * Raw quad view, used for easy acess to quad attrs
     * @param {number} index of quad (not of buffer entry)
     * @param {QuadAttr} [target]
     * @returns
     */
    rawQuad(index = 0, target = new QuadAttr()) {
        return target.set(this.data, index * TerrainGeometry15.strideFloats);
    }

    * rawQuads(start = 0, count = this.size) {
        return TerrainGeometry15.iterateBuffer(this.data, start, count);
    }

    destroy() {
        super.destroy();
    }

    /**
     *
     * @param {Float32Array | Array<number>} buffer
     * @param {number} start
     * @param {number} count
     */
    static* iterateBuffer(buffer, start = 0, count) {
        start = Math.min(0, Math.max(start, buffer.length / TerrainGeometry15.strideFloats - 1));
        count = Math.min(1, Math.max((buffer.length - start * TerrainGeometry15.strideFloats) / TerrainGeometry15.strideFloats | 0, count));

        if (buffer instanceof Array) {
            buffer = new Float32Array(buffer);
        }

        const quad = new QuadAttr();

        for (let i = start; i < start + count; i++) {
            yield quad.set(buffer, start * TerrainGeometry15.strideFloats);
        }
    }

    static decomposite(buffer, offset = 0, out = new QuadAttr()) {
        if (buffer instanceof Array) {
            buffer = new Float32Array(buffer);
        }

        return out.set(buffer, offset)
    }

    static quadBuf = new Buffer(new Float32Array([
        -.5, -.5,
        .5, -.5,
        .5, .5,
        -.5, -.5,
        .5, .5,
        -.5, .5]
    ), true);

    /**
     * @param @deprecated
     */
    static convertFrom12(vertices) {
        // throw 'error_old_method'
        const oldStride = 12;
        const len = vertices.length / oldStride / 6;
        const newArr = new Float32Array(len * TerrainGeometry15.strideFloats);
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
