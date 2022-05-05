//@ts-check
/// <reference path="./../../../types/index.d.ts" />

import BaseRenderer, {BaseCubeGeometry, CubeMesh} from "../BaseRenderer.js";
import {WebGPUTerrainShader} from "./WebGPUTerrainShader.js";
import {WebGPUMaterial} from "./WebGPUMaterial.js";
import {WebGPUTexture} from "./WebGPUTexture.js";
import {WebGPUTexture3D} from "./WebGPUTexture3D.js";
import {WebGPUBuffer} from "./WebGPUBuffer.js";
import {WebGPUCubeShader} from "./WebGPUCubeShader.js";
import {Resources} from "../../resources.js";
import { WebGPURenderTarget } from "./WebGPURenderTarget.js";
import {GPUMeshDrawer} from "./GPUMeshDrawer.js";
import {GPUCubeDrawer} from "./GPUCubeDrawer.js";

export default class WebGPURenderer extends BaseRenderer{
    constructor(view, options) {
        super(view, options);
        /**
         *
         * @type {GPUDevice} {null}
         */
        this.device = null;
        /**
         *
         * @type {GPUAdapter}
         */
        this.adapter = null;
        /**
         *
         * @type {GPUCanvasContext}
         */
        this.context = null;
        /**
         *
         * @type {GPURenderPipeline}
         */
        this.activePipeline = null;

        this.format = '';

        /**
         *
         * @type {GPUCommandEncoder}
         */
        this.encoder = null;

        /**
         *
         * @type {GPURenderPassEncoder}
         */
        this.passEncoder = null;

        this.passedBuffers = [];

        /**
         *
         * @type {GPUTexture}
         */
        this.depth = null;

        this.subMats = [];

        this.mesh = new GPUMeshDrawer(this);
        this.cube = new GPUCubeDrawer(this);
    }

    get currentBackTexture() {
        return this._target
            ? this._target.texture.view
            : this.context.getCurrentTexture().createView();
    }

    get currentDepth() {
        return this._target
            ? this._target.depthTexture.view
            : this.depth.createView();
    }

    createShader(options = {}) {
        return new WebGPUTerrainShader(this, options);
    }

    async createResourcePackShader(shader_uri) {
        let shaderCode = await Resources.loadWebGPUShader(shader_uri);
        return this.createShader(shaderCode);
    }

    createMaterial(options = {}) {
        return new WebGPUMaterial(this, options);
    }

    createTexture(options) {
        let texture;

        if (options.shared) {
            // can use exist texture
            texture = this._textures.find(t => t && t.isSimilar && t.isSimilar(options));

        }

        if (!texture) {
            texture = new WebGPUTexture(this, options);
        }

        texture.usage ++;

        return texture;
    }

    createTexture3D(options) {
        return new WebGPUTexture3D(this, options);
    }

    createBuffer(options) {
        return new WebGPUBuffer(this, options);
    }

    createCubeMap(options) {
        return new CubeMesh(new WebGPUCubeShader(this, options), new BaseCubeGeometry(this, options));
    }

    beginPass(options) {
        // if we has pass, close it
        if (this.encoder) {
            this.endPass();
        }

        super.beginPass(options);

        this.encoder = this.device.createCommandEncoder();
        this.passEncoder = this.encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.currentBackTexture,
                    loadValue: options.clearColor ? this._clearColor : 'load',
                    storeOp: 'store',
                }
            ]
            ,
            depthStencilAttachment: {
                view: this.currentDepth,

                depthLoadValue: options.clearDepth ? 1.0 : 'load',
                depthStoreOp: 'store',
                stencilLoadValue: 0,
                stencilStoreOp: 'discard',
            },
        });

        this.passEncoder.setViewport(
            this._viewport[0],
            this._viewport[1],
            this._viewport[2],
            this._viewport[3],
            0, 1
        );
    }

    drawCube(cube) {
        cube.shader.update();
        this.passEncoder.setPipeline(cube.shader.pipeline);
        this.passEncoder.setBindGroup(0, cube.shader.group);

        cube.geom.vertex.bind();
        this.passEncoder.setVertexBuffer(0, cube.geom.vertex.buffer);

        cube.geom.index.bind();
        this.passEncoder.setIndexBuffer(cube.geom.index.buffer, 'uint16');
        this.passEncoder.drawIndexed(36);
    }

    endPass() {
        super.endPass();

        if (!this.encoder) {
            return;
        }

        this.passEncoder.endPass();
        this.device.queue.submit([this.encoder.finish()]);

        this.subMats.forEach(e => e.destroy());
        this.subMats.length = 0;

        this.passEncoder = null;
        this.encoder = null;
    }

    async init(args) {
        super.init(args);
        this.adapter = await navigator.gpu.requestAdapter();
        this.device = await this.adapter.requestDevice();
        this.context = this.view.getContext('webgpu');
        this.format = this.context.getPreferredFormat(this.adapter);
        this._emptyTex3D.upload();
    }

    resize(w, h) {
        if (this.size.width === w && this.size.height === h) {
            return;
        }

        super.resize(w, h);

        this.view.width = w;
        this.view.height = h;
    }

    _configure() {
        if (this.size.width * this.size.height < 1)
            return;

        super._configure();

        this.context.configure({
            size: this.size,
            format: this.format,
            device: this.device
        });

        if (this.depth)
            this.depth.destroy();

        this.depth = this.device.createTexture({
            size: this.size,
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    createRenderTarget(options) {
        return new WebGPURenderTarget(this, options);
    }

    /**
     *
     * @param {WebGPURenderTarget} target
     */
    setTarget(target) {
        super.setTarget(target);
    }

}

/**
 *
 * @param {HTMLCanvasElement} view
 */
WebGPURenderer.test = function(view, options = {}) {
    const context = navigator.gpu && view.getContext('webgpu');
    return !!context;
}

WebGPURenderer.kind = 'webgpu';
