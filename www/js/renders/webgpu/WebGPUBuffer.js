import {BaseBuffer} from "../BaseRenderer.js";

const GPU_BUFFER_TYPE = {
    'index'   : 16,//GPUBufferUsage.INDEX,
    'vertex'  : 32,//GPUBufferUsage.VERTEX,
    'uniform' : 64,//GPUBufferUsage.UNIFORM
}
export class WebGPUBuffer extends BaseBuffer {
    /**
     *
     * @param {WebGPURenderer} context
     * @param options
     */
    constructor(context, options) {
        super(context, options);

        /**
         *
         * @type {GPUBuffer}
         */
        this.buffer = null;
    }

    update() {
        if (!this.dirty && this.buffer) {
            return;
        }

        const {
            /**
             * @type {GPUDevice}
             */
            device
        } = this.context;

        if(!this.buffer || this.size < this._data.length) {
            
            const type = GPU_BUFFER_TYPE[this.type];

            if (this.buffer) {
                this.buffer.destroy();
            }

            this.buffer = device.createBuffer({
                size: this._data.byteLength,
                usage: type | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true
            });

            if (this.type === 'index') {
                new Uint16Array(this.buffer.getMappedRange()).set(this._data);
            } else {
                new Float32Array(this.buffer.getMappedRange()).set(this._data);
            }

            this.size = this._data.length;
            this.buffer.unmap();
            return;
        }

        device.queue.writeBuffer(this.buffer, 0, this._data.buffer, 0, this._data.byteLength);

        super.update();
    }

    bind() {
        if (this.dirty)
            this.update();

        // nothing
    }

    destroy() {
        if (this.buffer) {
            this.buffer.destroy();
        }

        this.buffer = null;
        this.options = null;
        this.lastLength = 0;
    }
}