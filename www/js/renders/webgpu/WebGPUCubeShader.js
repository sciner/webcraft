import {BaseCubeShader} from "../BaseRenderer.js";

export class WebGPUCubeShader extends BaseCubeShader {
    /**
     *
     * @param {WebGPURenderer} context
     * @param options
     */
    constructor(context, options) {
        super(context, options);

        /**
         *
         * @type {GPURenderPipelineDescriptor}
         */
        this.description = null;
        /**
         *
         * @type {WebGPUTexture}
         */
        this.texture = null;

        this.vertexData = new Float32Array((16 + 16 + 16 + 3 + 1 + 1 + 1));
        this.fragmentData = new Float32Array((4 + 4 + 1 + 1 + 1 + 1));

        this._init();
    }
}