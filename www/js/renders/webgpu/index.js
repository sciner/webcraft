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

        /**
         *
         * @type {GPUBindGroup[]}
         */
        this.activeBindings = [];

        this.format = '';
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

    async init() {
        this.adapter = await navigator.gpu.requestAdapter();
        this.device = await this.adapter.requestDevice();
        this.context = this.view.getContext('webgpu');
        this.format = this.context.getPreferredFormat(this.adapter);
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