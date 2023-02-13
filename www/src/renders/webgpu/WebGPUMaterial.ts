import {BaseMaterial} from "../BaseRenderer.js";

export class WebGPUMaterial extends BaseMaterial {
    [key: string]: any;

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
            cullFace: null,
            lightTex: null
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

        this.textureData = null;

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

        const { style } = mat.texture;
        if (style) {
            mat.textureData = new Float32Array(this.shader.textureData);
            mat.textureData[0] = style.pixelSize;
            mat.textureData[1] = style.blockSize;
            mat.textureData[2] = style.mipmap;
        }
        return mat;
    }

    getLightMat(lightTex = null) {
        const mat = new WebGPUMaterial(this.context, {
            parent: this.parent || this, lightTex,  ...this.options
        });
        mat.texture = this.texture || this.shader.texture;
        mat.positionData = new Float32Array(this.shader.positionData);
        mat.textureData = this.textureData;

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
            fragmentData,
            textureData
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
        const positionData = this.positionData || this.shader.positionData;
        const textureData = this.textureData || this.shader.textureData;
        const lightTex = this.lightTex || this.context._emptyTex3D;

        if (!positionData) {
            return;
        }

        if (!this.positionUbo) {
            this.positionUbo = device.createBuffer({
                size: positionData.byteLength,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
            })
        }

        device.queue.writeBuffer(
            this.positionUbo, 0, positionData.buffer, positionData.byteOffset, positionData.byteLength
        );

        if (!this.textureUbo) {
            this.textureUbo = device.createBuffer({
                size: textureData.byteLength,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
            })
        }

        device.queue.writeBuffer(
            this.textureUbo, 0, textureData.buffer, textureData.byteOffset, textureData.byteLength
        );

        if (!this._skinGroup || texture !== this.lastState.texture
            || lightTex !== this.lastState.lightTex) {
            texture.bind();
            const lightBase = lightTex.baseTexture || lightTex;
            lightTex.bind();
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
                    {
                        binding: 3,
                        resource: {
                            buffer: this.textureUbo
                        }
                    },
                    {
                        binding: 4,
                        resource: lightBase.sampler,
                    },
                    {
                        binding: 5,
                        resource: lightBase.view,
                    },
                ]
            });
        }

        this.lastState.texture = texture;
        this.lastState.lightTex = lightTex;

    }

    updatePos(pos, modelMatrix = null) {
        const data = this.positionData || this.shader.positionData;
        if (modelMatrix) {
            data.set(modelMatrix)
        }

        const { camPos } = this.shader.globalUniforms;
        const shift = 16;

        if (pos) {
            data[shift] = pos.x - camPos.x;
            data[shift+1] = pos.z - camPos.z;
            data[shift+2] = pos.y - camPos.y;
        } else {
            data[shift] = - camPos.x;
            data[shift+1] = - camPos.z;
            data[shift+2] = - camPos.y;
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
            this.textureUbo.destroy();
            this.textureUbo = null;
        }

        this.positionData = null;
        this.textureData = null;
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
