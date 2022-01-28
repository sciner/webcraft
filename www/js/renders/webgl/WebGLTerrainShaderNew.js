import { UNIFORM_TYPE } from "../UBO.js";
import { WebGLUniversalShader } from "./WebGLUniversalShader.js";
import glMatrix from "../../../vendors/gl-matrix-3.3.min.js";

export class WebGLTerrainShaderNew extends WebGLUniversalShader {
     /**
     * @param {WebGLRenderer} context 
     * @param {*} options 
     */
    constructor(context, options) {
        super(context, options);

        this._material = null;

        this.modelMatrix    = glMatrix.mat4.create();

        this.blockSize      = 1;
        this.pixelSize      = 1;
        this.mipmap         = 0;
        this.addPos         = [0,0,0];
        this.texture        = null;    
        this.hasModelMatrix = false;
        
        this.globalID = -1;
        this.boundID = 0;

        // uniforms will autocompiled, but we can use manual loader
        // because i will remove autoinit uniforms 
        // global uniforms is UBO and not require quiery
        
        this._makeUniforms({
            // vert
            uModelMatrix: {
                type : UNIFORM_TYPE.MAT4,
                value: this.modelMatrix
            },                
            u_add_pos: {
                type : UNIFORM_TYPE.VEC3,
                value: this.addPos
            },
            u_pixelSize: {
                type : UNIFORM_TYPE.FLOAT,
                value: 1,
            },
            // frag
            u_texture: {
                type : 'sampler',/* not preset yet*/ 
                value: 4
            },
            u_lightTex: {
                type : 'sampler',/* not preset yet*/ 
                value: 5
            },
            u_mipmap: {
                type : UNIFORM_TYPE.FLOAT,
                value: 1,
            },
            u_blockSize: {
                type : UNIFORM_TYPE.FLOAT,
                value: 1
            },                
            u_opaqueThreshold:{
                type : UNIFORM_TYPE.FLOAT,
                value: 0.5
            },
        });

        // legacy
        this.a_position         = this.attrs['a_position'].location;
        this.a_axisX            = this.attrs['a_axisX'].location;
        this.a_axisY            = this.attrs['a_axisY'].location;
        this.a_uvCenter         = this.attrs['a_uvCenter'].location;
        this.a_uvSize           = this.attrs['a_uvSize'].location;
        this.a_color            = this.attrs['a_color'].location;
        this.a_flags            = this.attrs['a_flags'].location;
        this.a_quad             = this.attrs['a_quad'].location;
    }

    bind(force = false) {
        this.context.useShader(this, force)

        this._textureSlot = 0;

        // bind without update
        //this.update();
    }

    update() {
        // update called inside bind
        // problem that bind called a lot of times
        // need solve this case
        this.uniforms['uModelMatrix'].value = this.modelMatrix;
        this.hasModelMatrix = false;

        // not execute
        // because updatePos did this
        //
        // super.update();
    }

    updatePos(pos, modelMatrix) {
        const { gl, globalUniforms } = this.context;
        const { camPos } = globalUniforms;

        if (pos) {
            this.uniforms['u_add_pos'].value = [
                pos.x - camPos.x,
                pos.z - camPos.z,
                pos.y - camPos.y
            ];

        } else {
            this.uniforms['u_add_pos'].value = [
                0 - camPos.x,
                0 - camPos.z,
                0 - camPos.y
            ];
        }

        if (modelMatrix) {
            this.uniforms['uModelMatrix'].value = modelMatrix;
            this.hasModelMatrix = true;

        } else {
            if (this.hasModelMatrix) {
                this.uniforms['uModelMatrix'].value = this.modelMatrix;
            }

            this.hasModelMatrix = false;
        }

        // yep, need upload again
        this._applyUniforms();
    }
}