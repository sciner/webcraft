import {BaseTerrainShader} from "../BaseShader.js";
import { MIN_BRIGHTNESS } from "../../constant.js";

export class WebGLTerrainShader extends BaseTerrainShader {
    [key: string]: any;
    /**
     *
     * @param {WebGLRenderer} context
     * @param {*} options
     */
    constructor(context, options) {
        super(context, options);

        this.uProjMat           = this.getUniformLocation('u_projMatrix');
        this.uModelMatrix       = this.getUniformLocation('u_viewMatrix');
        this.uModelMat          = this.getUniformLocation('uModelMatrix');
        this.uModelMatMode      = this.getUniformLocation('uModelMatrixMode');

        this.u_add_pos          = this.getUniformLocation('u_add_pos');
        this.u_camera_pos       = this.getUniformLocation('u_camera_pos');
        this.u_camera_posi      = this.getUniformLocation('u_camera_posi');
        this.u_fogColor         = this.getUniformLocation('u_fogColor');
        // this.u_fogDensity       = this.getUniformLocation('u_fogDensity');
        this.u_fogAddColor      = this.getUniformLocation('u_fogAddColor');
        this.u_fogOn            = this.getUniformLocation('u_fogOn');
        this.u_crosshairOn      = this.getUniformLocation('u_crosshairOn');
        this.u_blockSize        = this.getUniformLocation('u_blockSize');
        this.u_pixelSize        = this.getUniformLocation('u_pixelSize');
        this.u_resolution       = this.getUniformLocation('u_resolution');
        this.u_eyeinwater       = this.getUniformLocation('u_eyeinwater');
        this.u_SunDir           = this.getUniformLocation('u_sunDir');
        this.u_mipmap           = this.getUniformLocation('u_mipmap');
        this.u_chunkBlockDist   = this.getUniformLocation('u_chunkBlockDist');
        this.u_brightness       = this.getUniformLocation('u_brightness');
        this.u_localLightRadius = this.getUniformLocation('u_localLightRadius');
        this.u_time             = this.getUniformLocation('u_time');
        this.u_lightOverride    = this.getUniformLocation('u_lightOverride');
        this.u_rain_strength    = this.getUniformLocation('u_rain_strength');
        this.u_gridChunkSize    = this.getUniformLocation('u_gridChunkSize');
        this.u_gridChunkOffset  = this.getUniformLocation('u_gridChunkOffset');

        this.locateUniforms();

        this.locateAttribs();
        // this.u_chunkLocalPos    = this.getUniformLocation('u_chunkLocalPos');

        this.hasModelMatrix = false;

        this._material = null;
        this._lightOverride = -2;
        this.globalID = -1;
    }

    locateAttribs() {
        const { program } = this;
        const { gl } = this.context;
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
        const { program } = this;
        const { gl } = this.context;
        // depends on material
        this.u_texture          = this.getUniformLocation('u_texture');
        this.u_texture_n        = this.getUniformLocation('u_texture_n');
        this.u_lightTex         = this.getUniformLocation('u_lightTex');
        this.u_lightOffset      = this.getUniformLocation('u_lightOffset');
        this.u_opaqueThreshold  = this.getUniformLocation('u_opaqueThreshold');
        this.u_tintColor        = this.getUniformLocation('u_tintColor');
        this.u_chunkDataSampler = this.getUniformLocation('u_chunkDataSampler');
        this.u_gridChunkSampler = this.getUniformLocation('u_gridChunkSampler');
        this.u_blockDayLightSampler = this.getUniformLocation('u_blockDayLightSampler');
        this.u_maskColorSampler = this.getUniformLocation('u_maskColorSampler');
        this.u_useNormalMap     = this.getUniformLocation('u_useNormalMap');
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
        const { gl } = this.context;
        const gu = this.globalUniforms;

        gl.uniformMatrix4fv(this.uModelMatrix, false, gu.viewMatrix);
        gl.uniformMatrix4fv(this.uProjMat, false, gu.projMatrix);
        // gl.uniform1f(this.u_fogDensity, this.fogDensity);
        gl.uniform4fv(this.u_fogColor, gu.fogColor);
        gl.uniform4fv(this.u_fogAddColor, gu.fogAddColor);
        gl.uniform1f(this.u_brightness, Math.max(gu.brightness, MIN_BRIGHTNESS));
        gl.uniform1f(this.u_chunkBlockDist, gu.chunkBlockDist);
        this.u_useNormalMap && gl.uniform1f(this.u_useNormalMap, gu.useNormalMap);

        const cx = gu.camPos.x, cy = gu.camPos.y, cz = gu.camPos.z;
        const px = Math.floor(cx), py = Math.floor(cy), pz = Math.floor(cz);
        gl.uniform3f(this.u_camera_pos, cx - px, cz - pz, cy - py);
        gl.uniform3i(this.u_camera_posi, px, pz, py);
        this.u_gridChunkSize && gl.uniform3f(this.u_gridChunkSize, gu.gridChunkSize.x, gu.gridChunkSize.z, gu.gridChunkSize.y);
        gl.uniform2fv(this.u_resolution, gu.resolution);
        this.u_eyeinwater && gl.uniform1f(this.u_eyeinwater, gu.eyeinwater);
        this.u_SunDir && gl.uniform4fv(this.u_SunDir, [...gu.sunDir, gu.useSunDir ? 1 : 0]);
        gl.uniform1f(this.u_localLightRadius, gu.localLigthRadius);
        // gl.uniform1f(this.u_opaqueThreshold, 0.0);
        this.u_fogOn && gl.uniform1i(this.u_fogOn, true);
        gl.uniform1f(this.u_crosshairOn, gu.crosshairOn);
        gl.uniform1f(this.u_time, gu.time);
        gl.uniform1f(this.u_rain_strength, gu.rainStrength);
    }

    setStaticUniforms() {
        const { gl } = this.context;
        gl.uniform1i(this.u_texture, 4);
        gl.uniform1i(this.u_texture_n, 5);
        gl.uniform1i(this.u_chunkDataSampler, 3);
        this.u_gridChunkSampler && gl.uniform1i(this.u_gridChunkSampler, 6);
        gl.uniform1iv(this.u_lightTex, [7, 8]);
        gl.uniform1i(this.u_maskColorSampler, 1);
        gl.uniform1i(this.u_blockDayLightSampler, 2);
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
        const { gl } = this.context;
        const gu = this.globalUniforms;
        if (this.globalID === -1) {
            this.setStaticUniforms();
        }
        const lu = this.lightUniforms;
        if (this._lightOverride !== lu.override) {
            let val = this._lightOverride = lu.override;
            if (val >= 0) {
                gl.uniform3f(this.u_lightOverride, ((val & 0xff) / 255.0), (((val >> 8) & 0xff) / 255.0),  1.0 + (val >> 16));
            } else {
                gl.uniform3f(this.u_lightOverride, 0.0, 0.0, 0.0);
            }
        }
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
