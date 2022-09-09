import {BaseMultiGeometry} from "../geom/BaseMultiGeometry.js";

export class FluidMultiGeometry extends BaseMultiGeometry {
    static strideFloats = 9;
    static sortAss = (a, b) => {
        return a - b;
    };

    constructor({context = null, size = 128} = {}) {
        super({context, size, strideFloats: FluidMultiGeometry.strideFloats});
        this.hasInstance = false;
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

        gl.enableVertexAttribArray(attribs.a_chunkId);
        gl.enableVertexAttribArray(attribs.a_fluidId);
        gl.enableVertexAttribArray(attribs.a_position);
        gl.enableVertexAttribArray(attribs.a_uv);
        gl.enableVertexAttribArray(attribs.a_color);
        gl.enableVertexAttribArray(attribs.a_flags);

        this.buffer.bind();

        gl.vertexAttribPointer(attribs.a_chunkId, 1, gl.FLOAT, false, stride, 0 * 4);
        gl.vertexAttribIPointer(attribs.a_fluidId, 1, gl.UNSIGNED_INT, stride, 1 * 4);
        gl.vertexAttribPointer(attribs.a_position, 3, gl.FLOAT, false, stride, 2 * 4);
        gl.vertexAttribPointer(attribs.a_uv, 2, gl.FLOAT, false, stride, 5 * 4);
        gl.vertexAttribIPointer(attribs.a_color, 1, gl.UNSIGNED_INT, stride, 7 * 4);
        gl.vertexAttribIPointer(attribs.a_flags, 1, gl.UNSIGNED_INT, stride, 8 * 4);

        // TODO: shared index buffer!
    }
}
