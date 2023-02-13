import { WebGLTerrainShader } from './WebGLTerrainShader.js';
import { QUAD_FLAGS } from '../../helpers.js';
import { DEFAULT_ATLAS_SIZE } from '../../constant.js';

export class WebGLFluidShader extends WebGLTerrainShader {
    [key: string]: any;
    /**
     *
     * @param {WebGLRenderer} context
     * @param {*} options
     */
    constructor(context, options) {
        super(context, options);

        //uniform int u_fluidFlags[4];
        // uniform vec4 u_fluidUV[4];
        // uniform int u_fluidFrames[4];

        //TODO: make this specific to resourcepack (material)
        this.fluidFlags = new Int32Array([
            QUAD_FLAGS.FLAG_ANIMATED | QUAD_FLAGS.FLAG_MULTIPLY_COLOR | QUAD_FLAGS.NO_AO,
            QUAD_FLAGS.FLAG_ANIMATED | QUAD_FLAGS.NO_CAN_TAKE_LIGHT,
        ]);
        const atlas_size = DEFAULT_ATLAS_SIZE * 1.;
        this.fluidUV = new Float32Array([
            32.0 / atlas_size, 32.0 / atlas_size, 0.0 / atlas_size, 0.0 / atlas_size,
            32.0 / atlas_size, 32.0 / atlas_size, 32.0 / atlas_size, 0.0 / atlas_size,
        ]);
        this.fluidFrames = new Int32Array([32, 32]);
    }

    locateAttribs() {
        const { program } = this;
        const { gl } = this.context;

        this.a_blockId       = gl.getAttribLocation(program, 'a_blockId');
        this.a_fluidId       = gl.getAttribLocation(program, 'a_fluidId');
        this.a_height        = gl.getAttribLocation(program, 'a_height');
        this.a_color         = gl.getAttribLocation(program, 'a_color');
    }

    resetMatUniforms() {
    }

    locateUniforms() {
        const { program } = this;
        const { gl } = this.context;
        // depends on material
        this.u_texture          = gl.getUniformLocation(program, 'u_texture');
        this.u_lightTex         = gl.getUniformLocation(program, 'u_lightTex');
        this.u_lightOffset      = gl.getUniformLocation(program, 'u_lightOffset');
        this.u_lightSize        = gl.getUniformLocation(program, 'u_lightSize');
        this.u_opaqueThreshold  = gl.getUniformLocation(program, 'u_opaqueThreshold');
        this.u_chunkDataSampler = gl.getUniformLocation(program, 'u_chunkDataSampler');
        this.u_blockDayLightSampler = gl.getUniformLocation(program, 'u_blockDayLightSampler');
        this.u_maskColorSampler = gl.getUniformLocation(program, 'u_maskColorSampler');
        this.u_useNormalMap     = gl.getUniformLocation(program, 'u_useNormalMap');

        this.u_fluidFlags       = gl.getUniformLocation(program, 'u_fluidFlags');
        this.u_fluidUV          = gl.getUniformLocation(program, 'u_fluidUV');
        this.u_fluidFrames      = gl.getUniformLocation(program, 'u_fluidFrames');
    }

    setStaticUniforms() {
        const { gl } = this.context;
        gl.uniform1i(this.u_texture, 4);
        gl.uniform1i(this.u_chunkDataSampler, 3);
        gl.uniform1iv(this.u_lightTex, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
        gl.uniform1i(this.u_maskColorSampler, 1);
        gl.uniform1i(this.u_blockDayLightSampler, 2);

        gl.uniform1iv(this.u_fluidFlags, this.fluidFlags);
        gl.uniform4fv(this.u_fluidUV, this.fluidUV);
        gl.uniform1iv(this.u_fluidFrames, this.fluidFrames);
    }
}
