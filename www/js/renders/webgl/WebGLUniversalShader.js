import { BaseShader } from "../BaseRenderer.js";
import WebGLRenderer from "./index.js";

const p = WebGLRenderingContext.prototype;

/**
 * @typedef UnformLoaderInfo
 * @property {string} name
 * @property {string} trimmedName
 * @property {WebGLUniformLocation} location
 * @property {WebGLActiveInfo} info
 * @property {*} value
 * @property {string} func
 * @property {string} type
 * @property {boolean} isolate isolate inoform, it will not upploaded from GU
 */

/**
 * @typedef AttrLoaderInfo
 * @property {string} name
 * @property {string} trimmedName
 * @property {number} location
 * @property {WebGLActiveInfo} info
 */

const U_LOADER = {
    'uniformMatrix4fv': (gl, ptr, value) => gl.uniformMatrix4fv(ptr, false, value)
}

const GL_TYPE_FUNC = {
    [p.BOOL] : {
        type : 'int',
        func : 'uniform1i'
    },

    [p.FLOAT] : {
        type : 'float',
        func : 'uniform1f' 
    },

    [p.SAMPLER_CUBE]: {
        type : 'int',
        func : 'uniform1i' 
    },

    [p.SAMPLER_2D] : {
        type : 'int',
        func : 'uniform1i' 
    },

    [p.FLOAT_VEC2] : {
        type: 'vec2',
        func: 'uniform2fv'
    },

    [p.FLOAT_VEC3] : {
        type: 'vec3',
        func: 'uniform3fv'
    },

    [p.FLOAT_VEC4] : {
        type: 'vec4',
        func: 'uniform4fv'
    },

    [p.FLOAT_MAT4] : {
        type: 'mat4',
        func: U_LOADER['uniformMatrix4fv']
    }
}

export class WebGLUniversalShader extends BaseShader {
    /**
     * 
     * @param {WebGLRenderer} context 
     * @param {*} options 
     */
    constructor (context, options) {
        super(context, options);

        this.useGlobalUniforms = options && options.useGlobalUniforms === false ? false : true;

        /**
         * @type {WebGLProgram}
         */
        this.program = context.createProgram(options.code, options.defines || {});

        /**
         * @type {AttrLoaderInfo[]}
         */
        this._attrsFlat = [];
        /**
         * @type {UnformLoaderInfo[]}
         */
        this._uniformsFlat = [];

        /**
         * @type {{[key: string] : AttrLoaderInfo }}
         */
        this.attrs = {};

        /**
         * @type {{[key: string] : UnformLoaderInfo}}
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

            const record = this.attrs[attr.name] = {
                location: gl.getAttribLocation(p, attr.name),
                info: attr,
                name: attr.name,
                trimmedName: attr.name.replace('a_', '')
            };

            this.attrs[record.trimmedName] = record;

            this._attrsFlat.push(record)
        }

        const uniformCount = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);

        for(let i = 0; i < uniformCount; i ++) {
            const uniform = gl.getActiveUniform(p, i);

            const record = this.uniforms[uniform.name] = {
                location: gl.getUniformLocation(p, uniform.name),
                info: uniform,
                name: uniform.name,
                isolate: false,
                trimmedName: uniform.name.replace('u_', '').replace('[]', '') // trim u_ and []
            };

            if (uniform.type in GL_TYPE_FUNC) {
                Object.assign(this.uniforms[uniform.name], GL_TYPE_FUNC[uniform.type]);
            }

            // for easy lookup
            this.uniforms[uniform.trimmedName] = record;

            this._uniformsFlat.push(record);
        }
    }

    //
    _makeUniforms(uniforms) {
        const {
            gl
        } = this.context;

        for(const name in uniforms) {
            if (!this.uniforms[name]) {
                console.warn('Unknow uniform location: ' + name);
                continue;
            }

            // we already know loaders
            if (this.uniforms[name].func) {
                this.uniforms[name].value = uniforms[name];
                continue;
            }

            console.log('Unknow uniform loader for', name, this.uniforms[name]);
        }
    }

    _applyUniforms() {
        const { gl, globalUniforms } = this.context;
        gl.useProgram(this.program);

        // Bind custom uniforms
        for(const unf of this._uniformsFlat) {
            const name = unf.name;
            const trimmed = unf.trimmedName;

            let value = unf.value;

            // try upload from GU
            // redefine base value
            if (this.useGlobalUniforms && !unf.isolate) {
                if (trimmed in globalUniforms) {
                    value = globalUniforms[trimmed];
                } else if (name in globalUniforms) {
                    value = globalUniforms[name];
                }
            }

            if (typeof value === 'undefined') {
                console.log('Uniform value missing for ', name, this.constructor.name);
                continue;
            }
            
            if (typeof unf.func === 'function') {
                unf.func(gl, unf.location, unf.value);
                continue;
            }

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

    unbind() {

    }

    update() {

        this._applyUniforms();
    }
}