import {BaseTexture3D} from "../BaseTexture3D.js";

const FORMATS = {
    'rgba8unorm': 'rgba8unorm',
    'u8': 'r8unorm',
    'u4_4_4_4': 'rgba8unorm',
}

const SZ = {
    'rgba8unorm': 4,
    'u8': 1,
}

export class WebGPUTexture3D extends BaseTexture3D {
    bind() {
        if (this.dirty) {
            return this.upload();
        }

        //console.warn('[WebGPUTexture] You can\'t bind WebGPU Texture');
    }

    upload() {
        const  {
            /**
             * @type {GPUDevice}
             */
            device
        } = this.context;

        /**
         *
         * @type {GPUTexture}
         */
        this.texture = this.texture || device.createTexture({
            format: FORMATS[this.type],
            dimension: '3d',
            size: [ this.width, this.height, this.depth ],
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
        });

        /**
         *
         * @type {GPUTextureView}
         */
        this.view = this.view || this.texture.createView({dimension: '3d' });

        /**
         *
         * @type {GPUSampler}
         */
        this.sampler = this.sampler || device.createSampler( {
            minFilter: this.minFilter || 'linear',
            magFilter: this.magFilter || 'linear',
        });

        const { data, width, height, depth } = this;

        if (!data) {
            return;
        }

        device.queue.writeTexture (
            { texture: this.texture },
            data,
            { bytesPerRow: width * SZ[this.type], rowsPerImage: height },
            { width, height, depthOrArrayLayers: depth },
        );


        super.upload();
    }
}
