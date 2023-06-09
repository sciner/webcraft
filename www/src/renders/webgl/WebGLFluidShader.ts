import { WebGLTerrainShader } from './WebGLTerrainShader.js';
import { QUAD_FLAGS } from '../../helpers.js';
import { DEFAULT_ATLAS_SIZE } from '../../constant.js';
import {UniformGroup} from "vauxcel";

const defaultFluidStaticUniforms = {
    u_fluidFrames: [0, 0] as tupleFloat2,
    u_fluidFlags: [0, 0] as tupleFloat2,
    u_fluidUV: [0, 0, 0, 0, 0, 0, 0, 0] as number[],
};

export class WebGLFluidShader extends WebGLTerrainShader {
    fluidStatic: UniformGroup<typeof defaultFluidStaticUniforms>;
    /**
     *
     * @param {WebGLRenderer} context
     * @param {*} options
     */
    constructor(context, options) {
        if (!options.uniforms) {
            options = {...options, uniforms: {}}
        }

        const fluidStatic = new UniformGroup<typeof defaultFluidStaticUniforms>(Object.assign({}, defaultFluidStaticUniforms), true);

        options.uniforms = {...options.uniforms, fluidStatic };

        super(context, options);

        this.fluidStatic = fluidStatic;

        //uniform int u_fluidFlags[4];
        // uniform vec4 u_fluidUV[4];
        // uniform int u_fluidFrames[4];

        //TODO: make this specific to resourcepack (material)
        fluidStatic.uniforms.u_fluidFlags = new Int32Array([
            QUAD_FLAGS.FLAG_ANIMATED | QUAD_FLAGS.FLAG_MULTIPLY_COLOR | QUAD_FLAGS.FLAG_NO_AO,
            QUAD_FLAGS.FLAG_ANIMATED | QUAD_FLAGS.FLAG_NO_CAN_TAKE_LIGHT,
        ]);
        const atlas_size = DEFAULT_ATLAS_SIZE * 1.;
        fluidStatic.uniforms.u_fluidUV = new Float32Array([
            32.0 / atlas_size, 32.0 / atlas_size, 0.0 / atlas_size, 0.0 / atlas_size,
            32.0 / atlas_size, 32.0 / atlas_size, 32.0 / atlas_size, 0.0 / atlas_size,
        ]);
        fluidStatic.uniforms.u_fluidFrames = new Int32Array([32, 32]);
    }
}
