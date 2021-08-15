import {BaseMaterial} from "../BaseRenderer.js";

export class WebGPUMaterial extends BaseMaterial {

    /**
     *
     * @param {WebGPUMaterial} context
     * @param {cullFace, opaque, shader} options
     */
    constructor(context, options) {
        super(context, options);

        /**
         *
         * @type {GPUBindGroup}
         */
        this.group = null;

        /**
         *
         * @type {GPURenderPipeline}
         */
        this.pipeline = null;

        /**
         *
         * @type {GPUBuffer}
         */
        this.vertexUbo = null;
        this.fragmentUbo = null;

        this.lastState = {
            shader: null,
            texture: null,
            cullFace: null
        };

        this._init();
    }

    _init() {
        const {
            device,
            activePipeline
        } = this.context;

        const {
            cullFace,
            texture,
            /**
             * @type {WebGPUTerrainShader}
             */
            shader,
            opaque
        } = this;

        const {
            fragmentData,
            vertexData
        } = shader;

        if (this.group) {
            this.group.destroy();
        }

        const base = shader.description;

        this.pipeline = device.createRenderPipeline({
            vertex: {
                ...base.vertex,
            },
            fragment: {
                ...base.fragment
            },
            primitive: {
                ...base.primitive,
                cullMode:  cullFace ? 'back' : 'none'
            },
            // Enable depth testing so that the fragment closest to the camera
            // is rendered in front.
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            }
        });

        this.vertexUbo = device.createBuffer({
            size: vertexData.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
        });

        this.fragmentUbo = device.createBuffer({
            size: fragmentData.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
        });

    }

    /**
     *
     * @param {WebGPURenderer} render
     */
    bind(render) {
        const {
            /**
             * @type {GPUDevice}
             */
            device,
        } = this.context;

        const {
            cullFace,
            texture,
            /**
             * @type {WebGPUTerrainShader}
             */
            shader,
            opaque
        } = this;

        const  {
            vertexData,
            fragmentData
        } = shader;

        // we can't use compileConstant, update UBO
        shader.opaqueThreshold = opaque  ? 0.5 : 0;

        // sync uniforms
        device.queue.writeBuffer(
            this.vertexUbo, 0, vertexData.buffer, vertexData.byteOffset, vertexData.byteLength
        );

        device.queue.writeBuffer(
            this.fragmentUbo, 0, fragmentData.buffer, fragmentData.byteOffset, fragmentData.byteLength
        );

        const l = this.lastState;
        // no rebuild group
        if (
            l.shader === shader &&
            l.texture === shader.texture &&
            l.cullFace === cullFace &&
            this.group
        ) {
            return;
        }

        this.lastState = {
            shader,
            cullFace,
            texture: shader.texture,
        };

        this.group = device.createBindGroup({
            // we should restricted know group and layout
            // will think that always 0
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.vertexUbo,
                        size: vertexData.byteLength
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.fragmentUbo,
                        size: fragmentData.byteLength
                    }
                },
                {
                    binding: 2,
                    resource: shader.texture.sampler,
                },
                {
                    binding: 3,
                    resource: shader.texture.view,
                },

            ]
        });


    }

    /**
     *
     * @param {WebGPURenderer} render
     */
    unbind(render) {

    }
}