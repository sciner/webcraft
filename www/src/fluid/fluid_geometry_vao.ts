import type {GeometryVaoOptions} from "../geom/base_geometry_vao.js";
import {BaseGeometryVao} from "../geom/base_geometry_vao.js";

export class FluidGeometryVao extends BaseGeometryVao {
    static strideFloats = 16;
    static vertexPerInstance = 4;
    static indexPerInstance = 6;

    vertexPerInstance: number;
    indexPerInstance: number;

    constructor(options: GeometryVaoOptions) {
        options.strideFloats = options.strideFloats ?? 16;
        super(options);
        this.vertexPerInstance = FluidGeometryVao.vertexPerInstance;
        this.indexPerInstance = FluidGeometryVao.indexPerInstance;
        this.hasInstance = false;
        this.hasIndex = true;
    }

    createVao() {
        const {attribs, gl} = this;
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        gl.enableVertexAttribArray(attribs.a_blockId);
        gl.enableVertexAttribArray(attribs.a_fluidId);
        gl.enableVertexAttribArray(attribs.a_height);
        gl.enableVertexAttribArray(attribs.a_color);

        this.buffer.bind();

        this.attribBufferPointers();
    }

    attribBufferPointers() {
        const {attribs, gl} = this;
        const stride = this.stride / this.vertexPerInstance;
        gl.vertexAttribIPointer(attribs.a_blockId, 1, gl.UNSIGNED_INT, stride, 0 * 4);
        gl.vertexAttribIPointer(attribs.a_fluidId, 1, gl.UNSIGNED_INT, stride, 1 * 4);
        gl.vertexAttribIPointer(attribs.a_color, 1, gl.UNSIGNED_INT, stride, 2 * 4);
        gl.vertexAttribPointer(attribs.a_height, 1, gl.FLOAT, false, stride, 3 * 4);
    }
}
