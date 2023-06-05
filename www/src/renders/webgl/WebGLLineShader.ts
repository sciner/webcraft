import {BaseLineShader} from "../BaseShader.js";

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
    }

    locateAttribs() {
        const { program } = this;
        const { gl } = this.context;
        this.a_point1           = this.getAttribLocation('aPoint1');
        this.a_point2           = this.getAttribLocation('aPoint2');
        this.a_lineWidth        = this.getAttribLocation('aLineWidth');
        this.a_color            = this.getAttribLocation('aColor');
        this.a_quad             = this.getAttribLocation('aQuad');
    }

    locateUniforms() {
        const { program } = this;
        const { gl } = this.context;
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
        this.context.pixiRender.shader.bind(this.defShader, true);
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(-2, -4);
        this.update();
    }

    unbind() {
        if (this._material)
        {
            this._material.unbind();
            this._material = null;
        }
        this.context._shader = null;
        const {gl} = this.context;
        gl.enable(gl.POLYGON_OFFSET_FILL);
    }

    updateGlobalUniforms() {
        const { gl } = this.context;
        const gu = this.globalUniforms;

        gl.uniformMatrix4fv(this.uViewMatrix, false, gu.viewMatrix);
        gl.uniformMatrix4fv(this.uProjMat, false, gu.projMatrix);

        gl.uniform2fv(this.u_resolution, gu.resolution);
        this.u_time && gl.uniform1f(this.u_time, gu.time);
        this.u_eyeinwater && gl.uniform1f(this.u_eyeinwater, 1.);

    }

    setStaticUniforms() {
        const { gl } = this.context;
    }

    resetMatUniforms() {
        const { gl } = this.context;
    }

    update() {
        const { gl } = this.context;
        const gu = this.globalUniforms;
        if (this.globalID === -1) {
            this.setStaticUniforms();
        }
        if (this.globalID === gu.updateID) {
            return;
        }
        this.globalID = gu.updateID;
        this.updateGlobalUniforms();

        this.resetMatUniforms();
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
