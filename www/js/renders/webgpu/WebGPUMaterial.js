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
        this.ubo = null;
        this.uboData = new Float32Array(1);

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

        this.group = device.createBindGroup({
            // we should restricted know group and layout
            // will think that always 0
            layout: activePipeline.getBindGroupLayout(0),
            entries: [
                // what should be this?
            ]
        });

        const stride = 21  * 4;
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
        })
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