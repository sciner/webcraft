import { BaseShader } from "../BaseRenderer.js";
import WebGLRenderer from "./index.js";

export class WebGLUniversalShader extends BaseShader {
    /**
     * 
     * @param {WebGLRenderer} context 
     * @param {*} options 
     */
    constructor (context, options) {
        super(context, options);

        /**
         * @type {WebGLProgram}
         */
        this.program = context.createProgram(options.code, options.defines || []);

        /**
         * @type {[key: string] : {location: number, info: WebGLActiveInfo, value: null }}
         */
        this.attrs = {};
        /**
         * @type {[key: string] : {location: WebGLUniformLocation,  info: WebGLActiveInfo, value: null }}
         */
        this.uniforms = {};

        this._queryAttrs();

        if (options.uniforms) {
            this._makeUniforms(options.uniforms);
        }
    }

    _queryAttrs() {
        /**
         * @type {WebGL2RenderingContext}
         */
        const gl = this.context.gl;
        const p = this.program;

        const attrsCount = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);

        for(let i = 0; i < attrsCount; i ++) {
            const attr = gl.getActiveAttrib(p, i);

            this.attrs[attr.name] = {
                location: gl.getAttribLocation(p, attr.name),
                info: attr
            };
        }

        const uniformCount = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);

        for(let i = 0; i < uniformCount; i ++) {
            const uniform = gl.getActiveUniform(p, i);

            this.uniforms[uniform.name] = {
                location: gl.getUniformLocation(p, uniform.name),
                info: uniform
            };
        }
    }

    //
    _makeUniforms(uniforms) {
        const {
            gl
        } = this.context;

        for(const name in uniforms) {
            const value = uniforms[name];
            let type = null;
            let func = null;
            
            switch(typeof value) {
                case 'boolean': {
                    type = 'bool';
                    func = 'uniform1f';
                    break;
                }

                case 'object': {
                    // matrix
                    if (value.length === 16) {
                        type = `mat4`;
                        func = `uniformMatrix4fv`;
                        break;
                    }

                    if (Array.isArray(value)) {
                        type = `vec${value.length}`;
                        func = `uniform${value.length}fv`;
                        break;
                    }

                    type = 'vec3';
                    func = 'uniform3fv';
                    break;
                }

                case 'number': {
                    type = 'float';
                    func = 'uniform1f';
                    break;
                }
                
                default: {
                    throw 'Unsupported uniform type ' + (typeof value);
                }
            }

            if (this.uniforms[name]) {
                throw 'Unknow uniform location' + name;
            }

            Object.assign(this.uniforms[name], {
                type,
                func,
                value
            });
        }
    }

    _applyUniforms() {
        const { gl } = this.context;
        gl.useProgram(this.program);

        // Bind custom uniforms
        for(const name in this.uniforms) {
            const unf = this.uniforms[name];

            if (!unf.func || !(unf.func in gl)) {
                continue;
            }

            if (unf.type === 'vec3' && unf.value && ('x' in unf.value)) {
                gl[unf.func](unf.location, [unf.value.x, unf.value.y, unf.value.z]);
            } else {
                gl[unf.func](unf.location, unf.value);
            }
        }
    }

    bind(force = false) {
        const gl = this.context.gl;
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

    update() {

        this._applyUniforms();
    }
}