import type BaseRenderer from "../renders/BaseRenderer";
import type {BaseBuffer} from "../renders/BaseRenderer";

export class FakeGeometryVao {
    context: BaseRenderer = null;
    vao: any = null;
    buffer: BaseBuffer = null;
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
        const fake = context.fake;
        gl.vertexAttribPointer(fake.shader.a_flipflop, 1, gl.FLOAT, false, 4,  0);
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
}
