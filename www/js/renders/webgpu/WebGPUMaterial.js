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
                ...base.fragment,
            },
            primitive: {
                ...base.primitive
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
            device
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