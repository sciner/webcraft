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
            QUAD_FLAGS.FLAG_ANIMATED | QUAD_FLAGS.FLAG_MULTIPLY_COLOR | QUAD_FLAGS.FLAG_NO_AO,
            QUAD_FLAGS.FLAG_ANIMATED | QUAD_FLAGS.FLAG_NO_CAN_TAKE_LIGHT,
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

        this.a_blockId       = this.getAttribLocation('a_blockId');
        this.a_fluidId       = this.getAttribLocation('a_fluidId');
        this.a_height        = this.getAttribLocation('a_height');
        this.a_color         = this.getAttribLocation('a_color');
    }

    resetMatUniforms() {
    }

    locateUniforms() {
        const { program } = this;
        const { gl } = this.context;
        // depends on material
        this.u_texture          = this.getUniformLocation('u_texture');
        this.u_lightTex         = this.getUniformLocation('u_lightTex');
        this.u_lightOffset      = this.getUniformLocation('u_lightOffset');
        this.u_chunkDataSampler = this.getUniformLocation('u_chunkDataSampler');
        this.u_blockDayLightSampler = this.getUniformLocation('u_blockDayLightSampler');
        this.u_maskColorSampler = this.getUniformLocation('u_maskColorSampler');
        this.u_useNormalMap     = this.getUniformLocation('u_useNormalMap');

        this.u_fluidFlags       = this.getUniformLocation('u_fluidFlags');
        this.u_fluidUV          = this.getUniformLocation('u_fluidUV');
        this.u_fluidFrames      = this.getUniformLocation('u_fluidFrames');
    }

    setStaticUniforms() {
        const { gl } = this.context;
        gl.uniform1i(this.u_texture, 4);
        gl.uniform1i(this.u_chunkDataSampler, 3);
        gl.uniform1iv(this.u_lightTex, [7, 8]);
        gl.uniform1i(this.u_maskColorSampler, 1);
        gl.uniform1i(this.u_blockDayLightSampler, 2);

        gl.uniform1iv(this.u_fluidFlags, this.fluidFlags);
        gl.uniform4fv(this.u_fluidUV, this.fluidUV);
        gl.uniform1iv(this.u_fluidFrames, this.fluidFrames);
    }
}
