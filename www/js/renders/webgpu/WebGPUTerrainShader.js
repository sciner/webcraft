import {BaseTerrainShader} from "../BaseRenderer.js";

export class WebGPUTerrainShader extends BaseTerrainShader{
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

        this._init();
    }

    _init() {
        const {
            device, format
        } = this.context;

        const {
            code
        } = this.options;

        this.description = {
            vertex: {
                module: device.createShaderModule({
                    code: code.vertex,
                }),
                entryPoint: 'main_vert',
                buffers: [
                    {
                        //position
                        arrayStride: 21 * 4,
                        stepMode: "instance",
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: 'float32x3',
                            },
                            {
                                shaderLocation: 1,
                                offset: 3 * 4,
                                format: 'float32x3',
                            },
                            {
                                shaderLocation: 2,
                                offset: 6 * 4,
                                format: 'float32x3',
                            },
                            {
                                shaderLocation: 3,
                                offset: 9 * 4,
                                format: 'float32x2',
                            },
                            {
                                shaderLocation: 4,
                                offset: 11 * 4,
                                format: 'float32x2',
                            },
                            {
                                shaderLocation: 5,
                                offset: 13 * 4,
                                format: 'float32x3',
                            },
                            {
                                shaderLocation: 6,
                                offset: 16 * 4,
                                format: 'float32x4',
                            },
                            {
                                shaderLocation: 7,
                                offset: 20 * 4,
                                format: 'float32',
                            }
                        ]
                    },
                    {
                        arrayStride: 6 * 4,
                        stepMode: "vertex",
                        attributes: [
                            {
                                shaderLocation: 8,
                                offset: 0,
                                format: "float32x2"
                            },
                            {
                                shaderLocation: 9,
                                offset: 2 * 4,
                                format: "float32x4"
                            }
                        ]
                    }
                ],
            },
            fragment: {
                module: device.createShaderModule({
                    code: code.fragment,
                }),
                entryPoint: 'main_frag',
                targets: [
                    {
                        format
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
            }
        };
    }
}