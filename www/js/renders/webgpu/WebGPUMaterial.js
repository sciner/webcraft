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
        this._skinGroup = null;

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

        /**
         * @type{WebGPUTexture}
         */
        this.texture = this.shader.texture;
    }

    get isSub() {
        return !!this.parent;
    }

    get skinGroup() {
        return this._skinGroup;
    }

    get group() {
        return this.parent ? this.parent.group : this._group;
    }

    get pipeline() {
        return this.parent ? this.parent.pipeline : this._pipeline;
    }

    /**
     *
     * @param {BaseTexture} texture - texture for submat, or will be used from shader
     * @return {WebGPUMaterial}
     */
    getSubMat(texture = null) {
        const mat = new WebGPUMaterial(this.context, {
            parent: this, ...this.options
        });

        texture && texture.bind();
        mat.texture = texture || this.texture || this.shader.texture;
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
            this.parent.bind(render, true);
            this.bindPosGroup();
            return;
        }

        const {
            /**
             * @type {GPUDevice}
             */
            device,
        } = this.context;

        const {
            cullFace,
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
            l.cullFace === cullFace &&
            this._group
        ) {
            return;
        }

        this.lastState = {
            shader,
            cullFace,
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
            ]
        });
    }

    bindPosGroup() {
        const {
            device
        } = this.context;

        const texture = this.texture || this.shader.texture;
        const data = this.positionData || this.shader.positionData;
        data[16 + 3] = texture.anisotropy;

        if (!data) {
            return;
        }

        if (!this.positionUbo) {
            this.positionUbo = device.createBuffer({
                size: data.byteLength,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
            })
        }

        device.queue.writeBuffer(
            this.positionUbo, 0, data.buffer, data.byteOffset, data.byteLength
        );

        if (!this._skinGroup || texture !== this.lastState.texture) {
            texture.bind();
            this._skinGroup = device.createBindGroup({
                layout: this.pipeline.getBindGroupLayout(1),
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this.positionUbo
                        }
                    },
                    {
                        binding: 1,
                        resource: texture.sampler,
                    },
                    {
                        binding: 2,
                        resource: texture.view,
                    },
                ]
            });
        }

        this.lastState.texture = texture;

    }

    updatePos(pos, modelMatrix = null) {
        const data = this.positionData || this.shader.positionData;
        if (modelMatrix) {
            data.set(modelMatrix)
        }

        const { camPos } = this.shader;
        const shift = 16;

        if (pos) {
            data[shift] = pos.x - camPos.x;
            data[shift+1] = pos.y - camPos.y;
            data[shift+2] = pos.z - camPos.z;
        } else {
            data[shift] = - camPos.x;
            data[shift+1] = - camPos.y;
            data[shift+2] = - camPos.z;
        }
    }

    /**
     *
     * @param {WebGPURenderer} render
     */
    unbind(render) {

    }

    destroy() {

        if (this._skinGroup) {
            this.positionUbo.destroy();
            this.positionUbo = null;
        }

        this.positionData = null;
        this._skinGroup = null;

        // this is sub mat, not destroy parent mat
        if(this.parent) {
            this.parent = null;
            super.destroy();
            return;
        }

        if (!this.group) {
            return;
        }

        this.lastState = {};
        this._group = null;
        this.fragmentUbo.destroy();
        this.vertexUbo.destroy();

        super.destroy();
    }
}
