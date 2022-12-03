import {Vector} from "../helpers.js";

export class LineGeometry {
    static strideFloats = 8;

    constructor() {
        // убрал, для уменьшения объема оперативной памяти
        // this.vertices = vertices;
        this.updateID = 0;
        this.uploadID = -1;
        this.strideFloats = LineGeometry.strideFloats;
        this.stride = this.strideFloats * 4;

        /**
         * @type {Float32Array}
         */
        this.resize(128);
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

        this.pos = new Vector();

        this.defColor = 0xFF00FF00;

        this.defWidth = 2;
    }

    resize(cnt) {
        this.size = cnt;
        const oldData = this.data;
        this.data = new Float32Array(this.strideFloats * cnt);
        this.uint32View = new Uint32Array(this.data.buffer);
        if (oldData) {
            this.data.set(oldData, 0);
        }
    }

    createVao() {
        const {attribs, gl, stride} = this;
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        gl.enableVertexAttribArray(attribs.a_point1);
        gl.enableVertexAttribArray(attribs.a_point2);
        gl.enableVertexAttribArray(attribs.a_lineWidth);
        gl.enableVertexAttribArray(attribs.a_color);
        gl.enableVertexAttribArray(attribs.a_quad);

        this.buffer.bind();
        gl.vertexAttribPointer(attribs.a_point1, 3, gl.FLOAT, false, stride, 0);
        gl.vertexAttribPointer(attribs.a_point2, 3, gl.FLOAT, false, stride, 3 * 4);
        gl.vertexAttribIPointer(attribs.a_lineWidth,  1, gl.FLOAT, stride, 6 * 4);
        gl.vertexAttribIPointer(attribs.a_color, 1, gl.UNSIGNED_INT, stride, 7 * 4);

        gl.vertexAttribDivisor(attribs.a_point1, 1);
        gl.vertexAttribDivisor(attribs.a_point2, 1);
        gl.vertexAttribDivisor(attribs.a_lineWidth, 1);
        gl.vertexAttribDivisor(attribs.a_color, 1);

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
                usage: 'static',
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
            this.buffer.updatePartial(this.instances * this.strideFloats);
        }
    }

    clear() {
        this.instances = 0;
        this.updateID++;
    }

    drawLine(x1, y1, z1, x2, y2, z2, isLocal = false, lineWidth = this.defWidth, colorBGRA = this.defColor) {
        const {data, uint32View, strideFloats, camPos} = this;
        let ind = (this.instances++) * strideFloats;
        if (isLocal) {
            data[ind++] = x1;
            data[ind++] = y1;
            data[ind++] = z1;
            data[ind++] = x2;
            data[ind++] = y2;
            data[ind++] = z2;
        } else {
            data[ind++] = x1 - camPos.x;
            data[ind++] = y1 - camPos.y;
            data[ind++] = z1 - camPos.z;
            data[ind++] = x2 - camPos.x;
            data[ind++] = y2 - camPos.y;
            data[ind++] = z2 - camPos.z;
        }
        data[ind++] = lineWidth;
        uint32View[ind++] = colorBGRA;
        this.updateID++;
    }

    drawAABB(aabb) {

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

    static quadBuf = null;

    static bindQuad(context, noBind = false) {
        if (LineGeometry.quadBuf) {
            LineGeometry.quadBuf.bind();
            return LineGeometry.quadBuf;
        }

        const quadBuf = LineGeometry.quadBuf = context.createBuffer({
            data: new Float32Array([
                0., -.5,
                1., -.5,
                1., .5,
                0., -.5,
                1., .5,
                0., .5]
            ),
            usage: 'static'
        });

        !noBind && quadBuf.bind();
        return quadBuf;
    }
}
