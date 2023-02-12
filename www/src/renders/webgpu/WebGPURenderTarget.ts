//@ts-check
/// <reference path="./../../../types/index.d.ts" />

import { BaseRenderTarget } from "../BaseRenderer.js";

export class WebGPURenderTarget extends BaseRenderTarget {
    constructor(context, options) {
        super(context, options);

        this.init();
    }

    init() {
        this.texture = this.context.createTexture({...this.options, type: this.context.format});
        this.texture.bind();

        if (this.options.depth) {
            this.depthTexture = this.context.createTexture({ ...this.options, type: 'depth24plus' });
            this.depthTexture.bind();
        }

        this.valid = true;
    }

    toRawPixels() {
        /**
         * @type {GPUDevice}
         */
        const device = this.context.device;
        /**
         * @type {GPUCommandEncoder}
         */
        const encoder = device.createCommandEncoder();;

        let buffer;
        const gpuBuffer = device.createBuffer({
            size: this.width * this.height * 4,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

    
        encoder.copyTextureToBuffer({
            texture: this.texture.texture,
            origin: [0,0,0]  
        }, {
            buffer: gpuBuffer,
            bytesPerRow: this.width * 4,
        }, [this.width, this.height, 0]);

        device.queue.submit([encoder.finish()]);

        return gpuBuffer.mapAsync(GPUMapMode.READ).then(()=>{
            buffer = new Uint8Array(gpuBuffer.getMappedRange());

            console.log(buffer);

            return buffer;
        });
    }
}