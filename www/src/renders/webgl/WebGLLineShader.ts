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

        const { program } = this;
        const { gl } = context;

        this.uProjMat           = this.getUniformLocation('uProjMatrix');
        this.uViewMatrix        = this.getUniformLocation('uViewMatrix');

        this.u_resolution       = this.getUniformLocation('u_resolution');
        this.u_eyeinwater       = this.getUniformLocation('u_eyeinwater');
        this.u_time             = this.getUniformLocation('u_time');

        this.locateUniforms();

        this.locateAttribs();

        this.globalID = -1;

        this.state = new State();
        this.state.blendMode = BLEND_MODES.NORMAL_NPM;
        this.state.depthTest = true;
        this.state.cullFace = true;
        this.state.polygonOffsetValue = -2;
        this.state.polygonOffsetScale = -4;
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
        const {gl} = this.context;
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
        this.context.pixiRender.shader.bind(this.defShader, false);
        this.context.pixiRender.state.set(this.state);
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

    updatePos(pos) {
        const { gl } = this.context;
        const {camPos} = this.globalUniforms;
        if (pos) {
            gl.uniform3f(this.u_add_pos, pos.x - camPos.x, pos.z - camPos.z, pos.y - camPos.y);
        } else {
            gl.uniform3f(this.u_add_pos, -camPos.x, -camPos.z, -camPos.y);
        }
    }
}
