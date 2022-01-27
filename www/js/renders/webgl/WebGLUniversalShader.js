import { BaseShader, BaseTexture, GlobalUniformGroup } from "../BaseRenderer.js";
import WebGLRenderer, { WebGLTexture } from "./index.js";

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

        this.type = undefined;
        this.func = undefined;

        this._value = null;
        this._lastLoadedValue = null;
        this._isDirty = true;
        this._shaderBoundID = -1;

        const rec = GL_TYPE_FUNC[this.info.type];

        if (rec) {
            this.type = rec.type;
            this.func = rec.func;
        }
    }

    get value () {
        return this._value;
    }

    set value(v) {
        if (v !== this._value) {
            this._isDirty = true;
        }

        this._value = v;
    }

    /**
     * fill from declaration if makeUniform
     * @param {} value 
     * @returns 
     */
    fill(value) {
        if (value == void 0) {
            return;
        }

        if (typeof value === 'object' && 'value' in value) {
            const {
                value = this.value,
                isolate = this.isolate,
            } = value;

            this.value = value;
            this.isolate = isolate;

            return;
        }

        this.value = value;
    }

    upload (force = false) {
        let  {
            name,
            trimmedName,
            _value: value,
            shader,
            isolate
        } = this;

        const globalUniforms = shader.context.globalUniforms;
        const gl = shader.context.gl;
        const isShaderRebound = shader.boundID === this._shaderBoundID;

        let needLoad = force || isShaderRebound || this._isDirty;

        // try upload from GU
        // redefine base value
        if (shader.useGlobalUniforms && !isolate) {
            if (trimmedName in globalUniforms) {
                value = globalUniforms[trimmedName];
            } else if (name in globalUniforms) {
                value = globalUniforms[name];
            }
        }

        if (typeof value !== 'object') {
            // check that last value is same
            needLoad = this._lastLoadedValue !== value || needLoad;
        }

        this._lastLoadedValue = value;

        // bind texture to slot
        // @todo
        // we should track texture bound value and re-upload uniform
        if (value instanceof WebGLTexture) {
            const slot = shader.getTextureSlot();

            value.bind(slot);
            value = slot;

        } else if(!needLoad) {
            // skip uniform if not require to upload
            return;
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
        this.program = context.createProgram(options.code, options.defines || {});

        this.boundID = 0;

        /**
         * @type {AttrLoaderInfo[]}
         */
        this._attrsFlat = [];
        /**
         * @type {UniformBinding[]}
         */
        this._uniformsFlat = [];

        // Temp value. Unfifrom call getTextureSlot when need bind texture
        this._textureSlot = 0;

        /**
         * @type {{[key: string] : AttrLoaderInfo }}
         */
        this.attrs = {};

        /**
         * @type {{[key: string] : UniformBinding}}
         */
        this.uniforms = {};

        this.globalBindingPoint = -1;

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

        const guIndex = gl.getUniformBlockIndex(p, 'GlobalUniforms');

        if (guIndex) {
            const guBind = this.context.globalUbo.bindingIndex;
            gl.uniformBlockBinding(guBind, guIndex);
        }

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

        const blockIdxs = gl.getActiveUniforms(p, Array.from({length: uniformCount}, (_, i) => i), gl.UNIFORM_BLOCK_INDEX);

        for(let i = 0; i < uniformCount; i ++) {
            // uniform in block, skip load
            if (blockIdxs[i] !== -1) {
                continue;
            }

            const info = gl.getActiveUniform(p, i);
            const loc = gl.getUniformLocation(p, info.name);
            const record = new UniformBinding(info, loc, this);

            this.uniforms[record.name] = record;
            // for easy lookup
            this.uniforms[record.trimmedName] = record;

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

            this.uniforms[name].fill(uniforms[name]);
        }
    }

    _applyUniforms() {
        for(let u of this._uniformsFlat) {
            u.upload();
        } 
    }

    getTextureSlot() {
        return this._textureSlot ++;
    }

    bind(force = false) {
        this.context.useShader(this, force)

        this._textureSlot = 0;

        this.update();
    }

    unbind() {

    }

    update() {

        this._applyUniforms();
    }
}