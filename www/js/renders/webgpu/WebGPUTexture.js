import {BaseTexture} from "../BaseRenderer.js";

export class WebGPUTexture extends BaseTexture {
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

        const isCube = Array.isArray(this.source) && this.source.length === 6;
        /**
         *
         * @type {GPUTexture}
         */
        this.texture = this.texture || device.createTexture({
            format: 'rgba8unorm',
            dimension: '2d',
            size: [ this.width, this.height, isCube ? 6 : 1 ],
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
        });

        /**
         *
         * @type {GPUTextureView}
         */
        this.view = this.view || this.texture.createView({dimension: isCube ? 'cube' : '2d' });

        /**
         *
         * @type {GPUSampler}
         */
        this.sampler = this.sampler || device.createSampler( {
            minFilter: this.minFilter || 'linear',
            magFilter: this.magFilter || 'linear',
            // maxAnisotropy: this.anisotropy || 0,
            // mipmapFilter: 'linear'
        });

        if (!this.source) {
            return;
        }

        const source = Array.isArray(this.source) ? this.source : [this.source];

        source.forEach((e, i) => {
            if (e instanceof Image) {
                self.createImageBitmap(e).then((bitmap) => this._copyTo(device, bitmap, i));
            } else {
                this._copyTo(device, e, i);
            }
        });

        super.upload();
    }

    _copyTo (device, source, layer) {
        device.queue.copyExternalImageToTexture(
                { source },
                { texture: this.texture, origin: [0,0, layer] },
                [this.width, this.height,]
        );
    }
}
