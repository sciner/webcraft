import type {GeometryVaoOptions} from "./base_geometry_vao.js";
import {BaseGeometryVao} from "./base_geometry_vao.js";

export class TerrainGeometryVao extends BaseGeometryVao {
    static strideFloats = 16;

    constructor(options: GeometryVaoOptions) {
        options.strideFloats = options.strideFloats ?? 16;
        super(options);
        this.hasInstance = true;
    }

    createVao() {
        const {attribs, gl} = this;
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

        gl.vertexAttribDivisor(attribs.a_position, 1);
        gl.vertexAttribDivisor(attribs.a_axisX, 1);
        gl.vertexAttribDivisor(attribs.a_axisY, 1);
        gl.vertexAttribDivisor(attribs.a_uvCenter, 1);
        gl.vertexAttribDivisor(attribs.a_uvSize, 1);
        gl.vertexAttribDivisor(attribs.a_color, 1);
        gl.vertexAttribDivisor(attribs.a_flags, 1);
        gl.vertexAttribDivisor(attribs.a_chunkId, 1);

        this.buffer.bind();

        this.attribBufferPointers();

        this.quad.bind();

        gl.vertexAttribPointer(attribs.a_quad, 2, gl.FLOAT, false, 2 * 4, 0);
    }

    attribBufferPointers(offsetInstances= 0) {
        const {attribs, gl, stride} = this;
        let offset = offsetInstances * stride;
        gl.vertexAttribPointer(attribs.a_position, 3, gl.FLOAT, false, stride, offset + 0);
        gl.vertexAttribPointer(attribs.a_axisX, 3, gl.FLOAT, false, stride, offset + 3 * 4);
        gl.vertexAttribPointer(attribs.a_axisY, 3, gl.FLOAT, false, stride, offset + 6 * 4);
        gl.vertexAttribPointer(attribs.a_uvCenter, 2, gl.FLOAT, false, stride, offset + 9 * 4);
        gl.vertexAttribPointer(attribs.a_uvSize, 2, gl.FLOAT, false, stride, offset + 11 * 4);
        gl.vertexAttribIPointer(attribs.a_color, 1, gl.UNSIGNED_INT, stride, offset + 13 * 4);
        gl.vertexAttribIPointer(attribs.a_flags, 1, gl.UNSIGNED_INT, stride, offset + 14 * 4);
        gl.vertexAttribPointer(attribs.a_chunkId, 1, gl.FLOAT, false, stride, offset + 15 * 4);
    }
}
