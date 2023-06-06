import { BaseShader } from "../BaseShader.js";
import * as VAUX from 'vauxcel';

export class WebGLUniversalShader extends BaseShader {
    uniShader: VAUX.Shader;
    /**
     *
     * @param {WebGLRenderer} context
     * @param {*} options
     */
    constructor (context, options) {
        super(context, options);

        if (options.uniforms) {
            this._makeUniforms(options.uniforms);
        }
    }

    //
    _makeUniforms(uniforms) {
        const {
            gl
        } = this.context;


        if (!this.uniShader) {
            this.uniShader = new VAUX.Shader(this.program, {...uniforms, globalUniforms: this.context.globalUniforms})
        } else {
            Object.assign(this.uniShader.uniforms, uniforms);
        }
        this.uniforms = this.uniShader.uniforms;
    }

    bind(force = false) {
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

        this.context.pixiRender.shader.bind(this.uniShader, false);
    }

    unbind() {

    }
}