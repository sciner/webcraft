import {BaseTexture} from "../BaseRenderer.js";

const TEXTURE_TYPE_FORMAT = {
    'rgba8u': {
        format: 'rgba8unorm' , type : 'UNSIGNED_BYTE'
    },
    'depth24stencil8': {
        format: 'depth24plus', internal: 'DEPTH24_STENCIL8' , type : 'UNSIGNED_INT_24_8'
    }
}

export class WebGPUTexture extends BaseTexture {
    [key: string]: any;
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

        const format = this.type in TEXTURE_TYPE_FORMAT
            ? TEXTURE_TYPE_FORMAT[this.type].format
            : this.type;

        /**
         *
         * @type {GPUTexture}
         */
        this.texture = this.texture || device.createTexture({
            format: format,
            dimension: '2d',
            size: [ this.width, this.height, isCube ? 6 : 1 ],
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
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
