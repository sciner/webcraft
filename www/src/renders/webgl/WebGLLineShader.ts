import {BaseLineShader} from "../BaseShader.js";
import {BLEND_MODES, State} from "vauxcel";

export class WebGLLineShader extends BaseLineShader {
    [key: string]: any;

    bind(force = false) {
        this.context.pixiRender.shader.bind(this.defShader);
        this.context.pixiRender.state.set(this.state);
    }

    unbind() {
    }

    update() {
    }
}
