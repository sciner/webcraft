import {BaseTerrainShader} from "../BaseShader.js";
import { MIN_BRIGHTNESS } from "../../constant.js";
import {UniformGroup} from "vauxcel";

export const defaultTerrainStaticUniforms = {
    u_texture: 4 as int,
    u_texture_n: 5 as int,
    u_chunkDataSampler: 3 as int,
    u_gridChunkSampler: 6 as int,
    u_lightTex: [7, 8] as int[],
    u_maskColorSampler: 1 as int,
    u_blockDayLightSampler: 2 as int,
};

export const terrainStatic = new UniformGroup<typeof defaultTerrainStaticUniforms>(defaultTerrainStaticUniforms);

export class WebGLTerrainShader extends BaseTerrainShader {
    [key: string]: any;
    terrainStatic = terrainStatic
    /**
     *
     * @param {WebGLRenderer} context
     * @param {*} options
     */
    constructor(context, options) {

        if (!options.uniforms) {
            options = {...options, uniforms: {}}
        }
        options.uniforms = {...options.uniforms, terrainStatic, lightStatic: context.lightUniforms };
        super(context, options);

        this.uModelMat          = this.getUniformLocation('uModelMatrix');
        this.uModelMatMode      = this.getUniformLocation('uModelMatrixMode');

        this.u_add_pos          = this.getUniformLocation('u_add_pos');
        this.u_blockSize        = this.getUniformLocation('u_blockSize');
        this.u_pixelSize        = this.getUniformLocation('u_pixelSize');
        this.u_mipmap           = this.getUniformLocation('u_mipmap');
        this.u_gridChunkOffset  = this.getUniformLocation('u_gridChunkOffset');

        this.locateUniforms();

        this.locateAttribs();
        // this.u_chunkLocalPos    = this.getUniformLocation('u_chunkLocalPos');

        this.hasModelMatrix = false;

        this._material = null;
        this.globalID = -1;
    }

    locateAttribs() {
        this.a_chunkId          = this.getAttribLocation('a_chunkId');
        this.a_position         = this.getAttribLocation('a_position');
        this.a_axisX            = this.getAttribLocation('a_axisX');
        this.a_axisY            = this.getAttribLocation('a_axisY');
        this.a_uvCenter         = this.getAttribLocation('a_uvCenter');
        this.a_uvSize           = this.getAttribLocation('a_uvSize');
        this.a_color            = this.getAttribLocation('a_color');
        this.a_flags            = this.getAttribLocation('a_flags' );
        this.a_quad             = this.getAttribLocation('a_quad');
    }

    locateUniforms() {
        // depends on material
        this.u_opaqueThreshold  = this.getUniformLocation('u_opaqueThreshold');
        this.u_tintColor        = this.getUniformLocation('u_tintColor');
    }

    bind(force = false) {
        const prevShader = this.context._shader;
        if (prevShader === this && !force)
        {
            if (this._material)
            {
                this._material.unbind();
                this._material = null;
            }
            this.update();
            // let path = new Error().stack
            // path = path.replaceAll('http://localhost:5700/', '').replaceAll(' at ', '\r\n')
            // if(!globalThis.asddfads)globalThis.asddfads=new Map()
            // const m = globalThis.asddfads
            // if(!m.has(path)) {
            //     m.set(path, 0)
            // }
            // m.set(path, m.get(path) + 1)
            // if(!globalThis.asdfg)globalThis.asdfg=0
            // if(globalThis.asdfg++%5000==0) {
            //     console.log(globalThis.asdfg)
            //     let mm = []
            //     for(let [k, v] of m.entries()) {
            //         mm.push(`${v} ... ${k}`)
            //     }
            //     console.log(mm)
            // }
            return;
        }
        if (prevShader) {
            prevShader.unbind();
        }
        this.context._shader = this;
        this.context.pixiRender.shader.bind(this.defShader, false);
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
    }

    resetMatUniforms() {
        const { gl } = this.context;
        gl.uniformMatrix4fv(this.uModelMat, false, this.modelMatrix);
        gl.uniform1i(this.uModelMatMode, 0);
        this.hasModelMatrix = false;
        // Tint color
        gl.uniform4fv(this.u_tintColor, this.tintColor.toArray());
    }

    update() {
        const gu = this.globalUniforms;
        if (this.globalID === gu.updateID) {
            return;
        }
        this.globalID = gu.updateID;
        this.resetMatUniforms();
    }

    updatePos(pos, modelMatrix) {
        const { gl } = this.context;
        const {camPos, gridTexSize} = this.globalUniforms;
        if (pos) {
            gl.uniform3f(this.u_add_pos, pos.x - camPos.x, pos.z - camPos.z, pos.y - camPos.y);
            if (this.u_gridChunkOffset) {
                const x = - pos.x + (-1 + Math.round(pos.x / gridTexSize.x)) * gridTexSize.x;
                const y = - pos.y + (-1 + Math.round(pos.y / gridTexSize.y)) * gridTexSize.y;
                const z = - pos.z + (-1 + Math.round(pos.z / gridTexSize.z)) * gridTexSize.z;
                gl.uniform3f(this.u_gridChunkOffset, x, z, y);
            }
        } else {
            gl.uniform3f(this.u_add_pos, -camPos.x, -camPos.z, -camPos.y);

            pos = camPos;
            if (this.u_gridChunkOffset) {
                const x = - pos.x + (-1 + Math.round(pos.x / gridTexSize.x)) * gridTexSize.x;
                const y = - pos.y + (-1 + Math.round(pos.y / gridTexSize.y)) * gridTexSize.y;
                const z = - pos.z + (-1 + Math.round(pos.z / gridTexSize.z)) * gridTexSize.z;
                gl.uniform3f(this.u_gridChunkOffset, x, z, y);
            }
        }
        if (modelMatrix) {
            gl.uniformMatrix4fv(this.uModelMat, false, modelMatrix);
            gl.uniform1i(this.uModelMatMode, 1);
            this.hasModelMatrix = true;
        } else {
            if (this.hasModelMatrix) {
                gl.uniformMatrix4fv(this.uModelMat, false, this.modelMatrix);
                gl.uniform1i(this.uModelMatMode, 0);
            }
            this.hasModelMatrix = false;
        }
    }
}
