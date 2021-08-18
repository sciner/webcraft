import {BaseCubeShader} from "../BaseRenderer.js";

export class WebGPUCubeShader extends BaseCubeShader {
    constructor(context, options) {
        super(context, options);

        const {
            device
        } = this.context;

        this.pipeline = device.createRenderPipeline({
            vertex: {
                module: device.createShaderModule({
                    code: this.code.vertex,
                }),
                entryPoint: 'main_vert',
                buffers: [
                    {
                        arrayStride: 3 * 4,
                        stepMode: "vertex",
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: "float32x3"
                            }
                        ]
                    }
                ],
            },
            fragment: {
                module: device.createShaderModule({
                    code: this.code.fragment,
                }),
                entryPoint: 'main_frag',
                targets: [
                    {
                        format: this.context.format,
                    },

                ],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none'
            },
            depthStencil: {
                depthWriteEnabled: false,
                depthCompare: 'less',
                format: 'depth24plus',
            }
        });

        this.ubo = device.createBuffer({
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            size: 16 * 4 + 16 * 4 + 4
        });

        /**
         *
         * @type {WebGPUTexture}
         */
        const t = this.texture;

        this.group = device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.ubo
                    }
                },
                {
                    binding: 1,
                    resource: t.sampler
                },

                {
                    binding: 2,
                    resource: t.view
                }
            ]
        });
    }

    update() {
        const {
            device
        } = this.context;

        device.queue.writeBuffer(this.ubo, 0, this.mergedBuffer.buffer);
    }

    bind() {
    }
}
