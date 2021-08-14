//@ts-check
import BaseRenderer from "../BaseRenderer.js";
import {WebGPUTerrainShader} from "./WebGPUTerrainShader.js";
import {WebGPUMaterial} from "./WebGPUMaterial.js";
import {WebGPUTexture} from "./WebGPUTexture.js";

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
         * @type {GPUQueue}
         */
        this.renderQueue = null;

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

        /**
         *
         * @type {GPUBuffer}
         */
        this.quad = null;

        /**
         *
         * @type {GPUBuffer}
         */
        this.instance = null;
    }

    get currentBackTexture() {
        return this.context.getCurrentTexture().createView();
    }

    createShader(options = {}) {
        return new WebGPUTerrainShader(this, options);
    }

    createMaterial(options = {}) {
        return new WebGPUMaterial(this, options);
    }

    createTexture(options = {}) {
        return new WebGPUTexture(this, options);
    }

    beginFrame(fogColor = [0,0,0,0]) {
        super.beginFrame(fogColor);

        this.encoder = this.device.createCommandEncoder();
        this.passEncoder = this.encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.currentBackTexture,
                    loadValue: [1, 0, 1, 1],
                    storeOp: 'store',
                }
            ]
        });
    }

    /**
     *
     * @param geom
     * @param {WebGPUMaterial} material
     */
    drawMesh(geom, material) {
        if (geom.size === 0) {
            return;
        }
        material.bind(this);
        /**
         * @type {Float32Array}
         */
        const data = geom.data;
        const buff = this.device.createBuffer({
            size: data.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
            mappedAtCreation: true
        });

        new Float32Array(buff.getMappedRange()).set(data);

        this.passEncoder.setPipeline(material.pipeline);
        this.passEncoder.setVertexBuffer(1, this.quad);
        this.passEncoder.setVertexBuffer(0, buff);
        this.passEncoder.setBindGroup(0, material.group);

        this.passEncoder.draw(6, geom.size);
        this.passEncoder.endPass();
    }

    endFrame() {
        this.passEncoder.endPass();
        this.device.queue.submit([this.encoder.finish()]);
    }

    async init() {
        this.adapter = await navigator.gpu.requestAdapter();
        this.device = await this.adapter.requestDevice();
        this.context = this.view.getContext('webgpu');
        this.format = this.context.getPreferredFormat(this.adapter);

        const quad = new Float32Array([
            -.5, -.5, 1, 0, 0, 0,
            .5, -.5, 0, 1, 0, 0,
            .5, .5, 0, 0, 1, 0,
            -.5, -.5, 1, 0, 0, 0,
            .5, .5, 0, 0, 1, 0,
            -.5, .5, 0, 0, 0, 1]);

        this.quad = this.device.createBuffer({
            usage: GPUBufferUsage.VERTEX,
            size: quad.byteLength,
            mappedAtCreation: true
        });

        new Float32Array(this.quad.getMappedRange()).set(quad);

        this.quad.unmap();
    }

    resize(w, h) {
        super.resize(w, h);

        this.view.width = w;
        this.view.height = h;
    }

    _configure() {
        super._configure();

        this.context.configure({
            size: this.size,
            format: this.format,
            device: this.device
        });
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