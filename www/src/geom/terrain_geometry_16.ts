import {GeometryTerrain, QuadAttr} from "../geometry_terrain.js";
import {Geometry, TYPES} from "vauxcel";
import type {BaseShader} from "../renders/BaseShader.js";

export class GeometryTerrain16 extends Geometry {
    [key: string]: any;
    constructor(vertices) {
        super();
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

        this.initGeom();
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

    initGeom() {
        const { stride } = this;
        this.addAttribute('a_position', this.buffer, 3, false, undefined, stride, 0, 1);
        this.addAttribute('a_axisX', this.buffer, 3, false, undefined, stride, 3 * 4, 1);
        this.addAttribute('a_axisY', this.buffer, 3, false, undefined, stride, 6 * 4, 1);
        this.addAttribute('a_uvCenter', this.buffer, 2, false, undefined, stride, 9 * 4, 1);
        this.addAttribute('a_uvSize', this.buffer, 2, false, undefined, stride, 11 * 4, 1);
        this.addAttribute('a_color', this.buffer, 1, false, TYPES.UNSIGNED_INT, stride, 13 * 4, 1);
        this.addAttribute('a_flags', this.buffer, 1, false, TYPES.UNSIGNED_INT, stride, 14 * 4, 1);
        this.addAttribute('a_chunkId', this.buffer, 1, false, undefined, stride, 15 * 4, 1);
        this.addAttribute('a_quad', GeometryTerrain.quadBuf, 2, false, undefined, 2 * 4, 0);
    }

    bind(shader: BaseShader) {
        if (shader) {
            this.context = shader.context;
        }
        if (this.uploadID !== this.updateID) {
            this.uploadID = this.updateID;
            this.buffer.update(this.data);
        }
        this.context.pixiRender.geometry.bind(this);
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
        super.destroy();
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
