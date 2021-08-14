import {BaseTexture} from "../BaseRenderer.js";

export class WebGPUTexture extends BaseTexture {
    bind() {
        if (this.dirty) {
            return this.upload();
        }

        console.warn('[WebGPUTexture] You can\'t bind WebGPU Texture');
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
            format: 'rgba8unorm',
            size: [ this.width, this.height ],
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
        });

        /**
         *
         * @type {GPUTextureView}
         */
        this.view = this.view || this.texture.createView();

        /**
         *
         * @type {GPUSampler}
         */
        this.sampler = this.sampler || device.createSampler( {
            minFilter: this.minFilter || 'linear',
            magFilter: this.magFilter || 'linear',
            maxAnisotropy: this.anisotropy || 0,
            mipmapFilter: 'linear'
        });

        if (this.source) {
            if (this.source instanceof Image) {
                this.source.decode()
                    .then(e => self.createImageBitmap(this.source))
                    .then((bitmap) => {
                        device.queue.copyExternalImageToTexture(
                            { source: bitmap },
                            { texture: this.texture },
                            [ this.width, this.height ]);
                    });
            } else {
                device.queue.copyExternalImageToTexture(
                    { source: this.source },
                    { texture: this.texture },
                    [ this.width, this.height ]);

            }
        }

        super.upload();
    }

}