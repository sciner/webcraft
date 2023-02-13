import {BaseTerrainShader} from "../BaseShader.js";
import {TerrainTextureUniforms} from "../common.js";

export class WebGPUTerrainShader extends BaseTerrainShader{
    [key: string]: any;
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
        this.vertexData = new Float32Array((16 + 16 + 1 + 1));
        this.positionData = new Float32Array((16 + 3));
        this.fragmentData = new Float32Array((4 + 4 + 1 + 1));
        this.textureData = new Float32Array(1 + 1 + 1);
        this.globalID = -1;

        this._init();
    }

    set opaqueThreshold(v) {
        this.fragmentData[9] = v;
    }

    get opaqueThreshold() {
        return this.fragmentData[9];
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
                        arrayStride: 17 * 4,
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
                                format: 'float32',
                            },
                        ]
                    },
                    {
                        arrayStride: 2 * 4,
                        stepMode: "vertex",
                        attributes: [
                            {
                                shaderLocation: 7,
                                offset: 0,
                                format: "float32x2"
                            },
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
                                srcFactor: 'one',
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
        this.update();
    }

    update() {
        const gu = this.globalUniforms;
        if (this.globalID === gu.updateID) {
            return;
        }
        this.globalID = gu.updateID;

        // vertex data UBO
        this.vertexData.set(gu.projMatrix, 0);
        this.vertexData.set(gu.viewMatrix, 16);
        //fog
        this.vertexData.set([1], 32);
        this.vertexData.set([gu.brightness], 32 + 1);

        // ModelMatrix
        this.positionData.set(this.modelMatrix, 0);
        // add_pos
        this.positionData.set(this.addPos, 16);

        //fragment data UBO

        // fog color
        this.fragmentData.set(gu.fogColor, 0);
        // fog add color
        this.fragmentData.set(gu.fogAddColor, 4);
        this.fragmentData.set([gu.chunkBlockDist], 8);
        // opaqueThreshold

        const style = this.texture && this.texture.style ? this.texture.style : TerrainTextureUniforms.default;
        this.textureData.set(style.pixelSize, 0);
        this.textureData.set(style.blockSize, 1);
        this.textureData.set(style.mipmap, 2);

        this.hasModelMatrix = false;
    }
}
