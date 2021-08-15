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
        /**
         *
         * @type {WebGPUTexture}
         */
        this.texture = null;

        this.vertexData = new Float32Array((16 + 16 + 16 + 3 + 1 + 1 + 1));
        this.fragmentData = new Float32Array((4 + 4 + 1 + 1 + 1 + 1));

        this._init();
    }

    set opaqueThreshold(v) {
        this.fragmentData[11] = v;
    }

    get opaqueThreshold() {
        return this.fragmentData[11];
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
                        format,
                        blend: {
                            alpha: {
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha',
                                operation: 'add'
                            },
                            color: {
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha',
                                operation: 'add'
                            },
                        },
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
            }
        };
    }

    bind() {
        super.bind();
    }

    update() {
        // vertex data UBO
        this.vertexData.set(this.projMatrix, 0);
        this.vertexData.set(this.viewMatrix, 16);
        this.vertexData.set(this.modelMatrix, 32);
        // add_pos
        this.vertexData.set([0,0,0], 32 + 16);
        //fog
        this.vertexData.set([1], 32 + 16 + 3);
        this.vertexData.set([this.brightness], 32 + 16 + 3 + 1);
        this.vertexData.set([this.pixelSize], 32 + 16 + 3 + 1 + 1);

        //fragment data UBO

        // fog color
        this.fragmentData.set(this.fogColor, 0);
        // fog add color
        this.fragmentData.set(this.fogAddColor, 4);
        this.fragmentData.set([this.chunkBlockDist], 8);
        this.fragmentData.set([this.mipmap], 9);
        this.fragmentData.set([this.blockSize], 10);
        // opaqueThreshold
        //this.fragmentData.set([this.opaqueThreshold], 11);
    }
}
