import {BaseLineShader} from "../BaseShader.js";
import {BLEND_MODES, State} from "vauxcel";

export class WebGLLineShader extends BaseLineShader {
    [key: string]: any;
    /**
     *
     * @param {WebGLRenderer} context
     * @param {*} options
     */
    constructor(context, options) {



        super(context, options);

        this.locateAttribs();
    }

    locateAttribs() {
        this.a_point1           = this.getAttribLocation('aPoint1');
        this.a_point2           = this.getAttribLocation('aPoint2');
        this.a_lineWidth        = this.getAttribLocation('aLineWidth');
        this.a_color            = this.getAttribLocation('aColor');
        this.a_quad             = this.getAttribLocation('aQuad');
    }

    bind(force = false) {
        this.context.pixiRender.shader.bind(this.defShader);
        this.context.pixiRender.state.set(this.state);
    }

    unbind() {
    }

    update() {
    }
}
