import { WebGLTerrainShader } from './WebGLTerrainShader.js';

export class WebGLFluidShader extends WebGLTerrainShader {
    /**
     *
     * @param {WebGLRenderer} context
     * @param {*} options
     */
    constructor(context, options) {
        super(context, options);
    }

    locateAttribs() {
        const { gl } = context;
        const { program } = this;

        this.a_chunkId       = gl.getAttribLocation(program, 'a_chunkId');
        this.a_fluidId       = gl.getAttribLocation(program, 'a_fluidId');
        this.a_position      = gl.getAttribLocation(program, 'a_position');
        this.a_uv            = gl.getAttribLocation(program, 'a_uv');
        this.a_color         = gl.getAttribLocation(program, 'a_color');
        this.a_flags         = gl.getAttribLocation(program, 'a_flags');
    }

    resetMatUniforms() {
    }

    locateUniforms() {
        const { program, context } = this;
        const { gl } = context;
        // depends on material
        this.u_texture          = gl.getUniformLocation(program, 'u_texture');
        this.u_lightTex         = gl.getUniformLocation(program, 'u_lightTex');
        this.u_lightOffset      = gl.getUniformLocation(program, 'u_lightOffset');
        this.u_lightSize        = gl.getUniformLocation(program, 'u_lightSize');
        this.u_opaqueThreshold  = gl.getUniformLocation(program, 'u_opaqueThreshold');
        this.u_tintColor        = gl.getUniformLocation(program, 'u_tintColor');
        this.u_chunkDataSampler = gl.getUniformLocation(program, 'u_chunkDataSampler');
        this.u_blockDayLightSampler = gl.getUniformLocation(program, 'u_blockDayLightSampler');
        this.u_maskColorSampler = gl.getUniformLocation(program, 'u_maskColorSampler');
        this.u_useNormalMap     = gl.getUniformLocation(program, 'u_useNormalMap');
    }

    setStaticUniforms() {
        const { gl } = this.context;
        gl.uniform1i(this.u_texture, 4);
        gl.uniform1i(this.u_chunkDataSampler, 3);
        gl.uniform1iv(this.u_lightTex, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
        gl.uniform1i(this.u_maskColorSampler, 1);
        gl.uniform1i(this.u_blockDayLightSampler, 2);

        gl.uniform1i(this.u_blockDayLightSampler, 2);
    }
}
