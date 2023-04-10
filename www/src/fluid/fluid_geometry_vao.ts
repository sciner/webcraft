import type {GeometryVaoOptions} from "../geom/base_geometry_vao.js";
import {BaseGeometryVao} from "../geom/base_geometry_vao.js";

export class FluidBigGeometry extends BaseGeometryVao {
    static strideFloats = 16;
    static vertexPerInstance = 4;
    static indexPerInstance = 6;

    vertexPerInstance: number;
    indexPerInstance: number;

    constructor(options: GeometryVaoOptions) {
        options.strideFloats = options.strideFloats ?? 16;
        super(options);
        this.vertexPerInstance = FluidBigGeometry.vertexPerInstance;
        this.indexPerInstance = FluidBigGeometry.indexPerInstance;
        this.hasInstance = false;
        this.createIndex();
    }

    createIndex() {
        const size = this.size;
        const indexData = this.indexData = new Int32Array(size * 6);

        for (let i = 0; i < size; i++) {
            indexData[i * 6] = i * 4;
            indexData[i * 6 + 1] = i * 4 + 1;
            indexData[i * 6 + 2] = i * 4 + 2;
            indexData[i * 6 + 3] = i * 4;
            indexData[i * 6 + 4] = i * 4 + 2;
            indexData[i * 6 + 5] = i * 4 + 3;
        }

        if (this.indexBuffer) {
            this.indexBuffer.data = this.indexData;
        }
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

        this.indexBuffer = this.context.createBuffer({
            data: this.indexData,
            usage: 'static',
            index: true
        });
        this.indexBuffer.bind();
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