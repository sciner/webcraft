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

        this.locateUniforms();

        this.locateAttribs();

        this.globalID = -1;
    }

    locateAttribs() {
        this.a_point1           = this.getAttribLocation('aPoint1');
        this.a_point2           = this.getAttribLocation('aPoint2');
        this.a_lineWidth        = this.getAttribLocation('aLineWidth');
        this.a_color            = this.getAttribLocation('aColor');
        this.a_quad             = this.getAttribLocation('aQuad');
    }

    locateUniforms() {
        this.u_add_pos          = this.getUniformLocation('u_add_pos');
    }

    bind(force = false) {
        this.context.pixiRender.shader.bind(this.defShader);
        this.context.pixiRender.state.set(this.state);

        const prevShader = this.context._shader;
        if (prevShader === this && !force)
        {
            this.update();
            return;
        }
        if (prevShader) {
            prevShader.unbind();
        }
        this.context._shader = this;
        this.update();
    }

    unbind() {
        if (this._material)
        {
            this._material.unbind();
            this._material = null;
        }
        this.context._shader = null;
    }

    update() {
    }
}
