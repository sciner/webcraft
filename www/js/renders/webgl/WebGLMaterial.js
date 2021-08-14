import {BaseMaterial} from "../BaseRenderer.js";

export class WebGLMaterial extends BaseMaterial {
    constructor(context, options) {
        super(context, options);
    }

    bind() {
        const { gl } = this.context;
        if (!this.cullFace) {
            gl.disable(gl.CULL_FACE);
        }
        if (this.opaque) {
            gl.uniform1f(this.shader.u_opaqueThreshold, 0.5);
        }
    }

    unbind() {
        const { gl } = this.context;
        if (!this.cullFace) {
            gl.enable(gl.CULL_FACE);
        }
        if (this.opaque) {
            gl.uniform1f(this.shader.u_opaqueThreshold, 0.0);
        }
    }
}
