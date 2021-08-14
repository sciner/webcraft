import {BaseMaterial} from "../BaseRenderer.js";

export class WebGLMaterial extends BaseMaterial {
    constructor(context, options) {
        super(context, options);
    }

    bind(render) {
        const { gl } = render;
        if (!this.cullFace) {
            gl.disable(gl.CULL_FACE);
        }
        if (this.opaque) {
            gl.uniform1f(render.u_opaqueThreshold, 0.5);
        }
    }

    unbind(render) {
        const { gl } = render;
        if (!this.cullFace) {
            gl.enable(gl.CULL_FACE);
        }
        if (this.opaque) {
            gl.uniform1f(render.u_opaqueThreshold, 0.0);
        }
    }
}
