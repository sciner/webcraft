import {BaseMultiGeometry} from "../geom/BaseMultiGeometry.js";

export class FluidMultiGeometry extends BaseMultiGeometry {
    static strideFloats = 16;
    static vertexPerInstance = 4;
    static indexPerInstance = 6;
    static sortAss = (a, b) => {
        return a - b;
    };

    constructor({context = null, size = 128} = {}) {
        super({
            context, size, strideFloats: FluidMultiGeometry.strideFloats});
        this.vertexPerInstance = FluidMultiGeometry.vertexPerInstance;
        this.indexPerInstance = FluidMultiGeometry.indexPerInstance;
        this.stride /= this.vertexPerInstance;
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

    resize(newSize) {
        super.resize(newSize);
        this.createIndex();
    }

    // in uint a_chunkId;
    // in uint a_fluidId;
    // in uint a_flags;
    // in vec3 a_position;
    // in vec2 a_uv;
    // in vec2 a_biome;

    createVao() {
        const {attribs, gl, stride} = this;
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        gl.enableVertexAttribArray(attribs.a_blockId);
        gl.enableVertexAttribArray(attribs.a_fluidId);
        gl.enableVertexAttribArray(attribs.a_height);
        gl.enableVertexAttribArray(attribs.a_color);

        this.buffer.bind();

        gl.vertexAttribIPointer(attribs.a_blockId, 1, gl.UNSIGNED_INT, stride, 0 * 4);
        gl.vertexAttribIPointer(attribs.a_fluidId, 1, gl.UNSIGNED_INT, stride, 1 * 4);
        gl.vertexAttribIPointer(attribs.a_color, 1, gl.UNSIGNED_INT, stride, 2 * 4);
        gl.vertexAttribPointer(attribs.a_height, 1, gl.FLOAT, false, stride, 3 * 4);

        this.indexBuffer = this.context.createBuffer({
            data: this.indexData,
            usage: 'static',
            index: true
        });
        this.indexBuffer.bind();
    }
}
