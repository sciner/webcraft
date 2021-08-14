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
         * @type {GPUBuffer}
         */
        this.vertexUbo = null;
        this.fragmentUbo = null;

        this.vertexUboData = new Float32Array(1);
        this.fragmentUboData = new Float32Array(1);

        /**
         *
         * @type {GPURenderPipeline}
         */
        this.pipeline = null;

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

        const vsize = 4 * (16 + 16 + 16 + 1 + 1 + 3 + 1);
        const fsize = 4 * (4 + 4 + 1 + 1 + 1 + 1);
        this.vertexUbo = device.createBuffer({
            size: vsize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
        });

        this.fragmentUbo = device.createBuffer({
            size: fsize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
        });

        this.group = device.createBindGroup({
            // we should restricted know group and layout
            // will think that always 0
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.vertexUbo,
                        size: vsize
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.fragmentUbo,
                        size: fsize
                    }
                },
            ]
        });

    }

    /**
     *
     * @param {WebGPURenderer} render
     */
    bind(render) {

    }

    /**
     *
     * @param {WebGPURenderer} render
     */
    unbind(render) {

    }
}