import type BaseRenderer from "../renders/BaseRenderer";
import type {BaseBuffer} from "../renders/BaseRenderer";
import type {IvanArray} from "../helpers";
import type {GeomCopyOperation} from "./big_geom_batch_update";

export class SillyGeometryVao {
    context: BaseRenderer = null;
    vao: any = null;
    buffer: BaseBuffer = null;
    stride = 16;
    strideBytes = this.stride * 4;

    transformFeedback: WebGLTransformFeedback = null;

    init(context) {
        this.context = context;
        this.buffer = context.createBuffer({
            data: new Float32Array(4),
            usage: 'static',
        });
        (this.buffer as any).glTrySubData = false;
        const {gl} = context;
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        this.buffer.bind();
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        gl.enableVertexAttribArray(3);
        this.attribBufferPointers();
        this.transformFeedback = gl.createTransformFeedback();
    }

    attribBufferPointers(offset = 0) {
        const {gl, silly} = this.context;
        gl.vertexAttribPointer(silly.shader.a_silly1, 4, gl.FLOAT, false, 64,  offset + 0);
        gl.vertexAttribPointer(silly.shader.a_silly2, 4, gl.FLOAT, false, 64,  offset + 16);
        gl.vertexAttribPointer(silly.shader.a_silly3, 4, gl.FLOAT, false, 64,  offset + 32);
        gl.vertexAttribPointer(silly.shader.a_silly4, 4, gl.FLOAT, false, 64,  offset + 48);
    }

    bind() {
        const {gl} = this.context;
        gl.bindVertexArray(this.vao);
        this.buffer.bind();
    }

    draw(data) {
        this.buffer.data = data;
        this.context.fake.draw(this);
    }

    batchUpdate(inBuffer: any, outBuffer: any, copies: IvanArray<GeomCopyOperation>, strideBytes: number) {
        this.context.silly.batchUpdate(this, inBuffer, outBuffer, copies, strideBytes);
    }
}
