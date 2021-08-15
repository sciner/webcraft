import {BaseMaterial} from "../BaseRenderer.js";

export class WebGPUMaterial extends BaseMaterial {

    /**
     *
     * @param {WebGPUMaterial} context
     * @param {{cullFace, opaque, shader, parent}} options
     */
    constructor(context, options) {
        super(context, options);

        /**
         *
         * @type {GPUBindGroup}
         */
        this._group = null;
        /**
         *
         * @type {GPUBindGroup}
         */
        this._posGroup = null;

        /**
         *
         * @type {GPURenderPipeline}
         */
        this._pipeline = null;

        /**
         *
         * @type {GPUBuffer}
         */
        this.vertexUbo = null;
        this.positionUbo = null;
        this.fragmentUbo = null;

        this.lastState = {
            shader: null,
            texture: null,
            cullFace: null
        };


        if (!options.parent) {
            this._init();
        }

        this.parent = options.parent;

        /**
         *
         * @type {Float32Array}
         */
        this.positionData = null;
    }

    get posGroup() {
        return this._posGroup;
    }

    get group() {
        return this.parent ? this.parent.group : this._group;
    }

    get pipeline() {
        return this.parent ? this.parent.pipeline : this._pipeline;
    }

    getSubMat() {
        const mat = new WebGPUMaterial(this.context, {
            parent: this
        });

        mat.positionData = new Float32Array(this.shader.positionData);
        return mat;
    }

    _init() {
        const {
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

        const {
            fragmentData,
            vertexData,
            positionData
        } = shader;

        const base = shader.description;

        this._pipeline = device.createRenderPipeline({
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

    bind(render, supressExtend) {
        if (this.parent) {
            parent.bind(render, true);
            this.bindPosGroup();
        }

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
             * @type {WebGPUTerrainShader | WebGPUCubeShader}
             */
            shader,
            opaque
        } = this;

        const  {
            vertexData,
            fragmentData
        } = shader;

        if ('opaqueThreshold' in shader) {
            // we can't use compileConstant, update UBO
            shader.opaqueThreshold = opaque ? 0.5 : 0;
        }

        // update only when not extended

        if (!supressExtend) {
            this.bindPosGroup();
        }

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
            this._group
        ) {
            return;
        }

        this.lastState = {
            shader,
            cullFace,
            texture: shader.texture,
        };

        this._group = device.createBindGroup({
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

    bindPosGroup() {
        const {
            device
        } = this.context;

        const data = this.positionData || this.shader.positionData;

        if (data) {
            this.positionUbo = device.createBuffer({
                size: data.byteLength,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
            })
        }

        if (data && this.positionUbo) {
            device.queue.writeBuffer(
                this.positionUbo, 0, data.buffer, data.byteOffset, data.byteLength
            );

            this._posGroup = this._posGroup || device.createBindGroup({
                layout: this.pipeline.getBindGroupLayout(1),
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this.positionUbo
                        }
                    }
                ]
            });
        }
    }

    updatePos(addPos, modelMatrix) {
        const data = this.positionData || this.shader.positionData;

        data.set(modelMatrix)
        data.set(addPos, 16);
    }

    /**
     *
     * @param {WebGPURenderer} render
     */
    unbind(render) {

    }

    destroy() {
        if (!this.group) {
            return;
        }

        this.lastState = {};
        this.group = null;
        this.fragmentUbo.destroy();
        this.vertexUbo.destroy();

        super.destroy();
    }

    getSubMat() {
        return new WebGPUMaterial()
    }
}