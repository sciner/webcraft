import {BaseBuffer} from "../BaseRenderer.js";

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
        this.lastLength = null;
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

        if(!this.buffer || this.lastLength < this._data.length) {

            if (this.buffer) {
                this.buffer.destroy();
            }

            this.buffer = device.createBuffer({
                size: this._data.byteLength,
                usage: (this.index ? GPUBufferUsage.INDEX : GPUBufferUsage.VERTEX) | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true
            });

            if (this.index) {
                new Uint16Array(this.buffer.getMappedRange()).set(this._data);
            } else {
                new Float32Array(this.buffer.getMappedRange()).set(this._data);
            }

            this.lastLength = this._data.length;
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