import {BaseLineShader} from "../BaseShader.js";

export class WebGLLineShader extends BaseLineShader {
    /**
     *
     * @param {WebGLRenderer} context
     * @param {*} options
     */
    constructor(context, options) {
        super(context, options);

        const { gl } = context;
        const program  = this.program = context.createProgram(options.code, {});

        this.uProjMat           = gl.getUniformLocation(program, 'uProjMatrix');
        this.uViewMatrix        = gl.getUniformLocation(program, 'uViewMatrix');

        this.u_resolution       = gl.getUniformLocation(program, 'u_resolution');
        this.u_time             = gl.getUniformLocation(program, 'u_time');

        this.locateUniforms();

        this.locateAttribs();

        this.globalID = -1;
    }

    locateAttribs() {
        const { program } = this;
        const { gl } = this.context;
        this.a_point1           = gl.getAttribLocation(program, 'aPoint1');
        this.a_point2           = gl.getAttribLocation(program, 'aPoint2');
        this.a_lineWidth        = gl.getAttribLocation(program, 'aLineWidth');
        this.a_color            = gl.getAttribLocation(program, 'aColor');
        this.a_quad             = gl.getAttribLocation(program, 'aQuad');
    }

    locateUniforms() {
        const { program } = this;
        const { gl } = this.context;
        this.u_add_pos          = gl.getUniformLocation(program, 'u_add_pos');
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
        gl.useProgram(this.program);
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

    updateGlobalUniforms() {
        const { gl } = this.context;
        const gu = this.globalUniforms;

        gl.uniformMatrix4fv(this.uViewMatrix, false, gu.viewMatrix);
        gl.uniformMatrix4fv(this.uProjMat, false, gu.projMatrix);

        gl.uniform2fv(this.u_resolution, gu.resolution);
        gl.uniform1f(this.u_time, gu.time);
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
