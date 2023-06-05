import { BaseShader } from "../BaseShader.js";
import { WebGLTexture } from "./index.js";
import * as VAUX from 'vauxcel';

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
 * @property {number} slot - for textures
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

export class UniformBinding {
    [key: string]: any;
    /**
     * @param {WebGLActiveInfo} info
     * @param {WebGLUniformLocation} location
     * @param {WebGLUniversalShader} shader
     */
    constructor (info, location, shader) {
        this.shader = shader;
        this.location = location;
        this.info = info;
        this.name = info.name;
        this.trimmedName = this.name.replace('u_', '').replace('[]', '');
        this.isolated = false;

        this.value = undefined;
        this.type = undefined;
        this.func = undefined;

        const rec = GL_TYPE_FUNC[this.info.type];

        if (rec) {
            this.type = rec.type;
            this.func = rec.func;
        }
    }

    /**
     * fill from declaration if makeUniform
     * @param {} valueArg
     * @returns
     */
    fill(valueArg) {
        if (valueArg == void 0) {
            return;
        }

        if (typeof valueArg === 'object' && 'value' in valueArg) {
            const {
                value = this.value,
                isolate = this.isolate,
            } = valueArg;

            this.value = value;
            this.isolate = isolate;

            return;
        }

        this.value = valueArg;
    }

    upload () {
        let  {
            name,
            trimmedName,
            value,
            shader,
            isolate
        } = this;

        const globalUniforms = shader.context.globalUniforms;
        const gl = shader.context.gl;

        // try upload from GU
        // redefine base value
        if (shader.useGlobalUniforms && !isolate) {
            if (trimmedName in globalUniforms) {
                value = globalUniforms[trimmedName];
            } else if (name in globalUniforms) {
                value = globalUniforms[name];
            }
        }

        // bind texture to slot
        if (value instanceof WebGLTexture) {
            const slot = shader.getTextureSlot();

            value.bind(slot);
            value = slot;
        }

        if (typeof value === 'undefined') {
            console.log('Uniform value missing for ', name, this.shader.constructor.name);
            return;
        }

        if (typeof this.func === 'function') {
            this.func(gl, this.location, value);
            return;
        }

        if (!this.func || !(this.func in gl)) {
            console.log('Uniform load method missing for ', name, this.shader.constructor.name);
            return;
        }

        if (this.type === 'vec3' && this.value && ('x' in value)) {
            gl[this.func](this.location, [value.x, value.y, value.z]);
        } else {
            gl[this.func](this.location, value);
        }
    }

    valueOf() {
        return this.value;
    }

    toString() {
        return `[Uniform ${this.name}] : ${this.value}`;
    }
}

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