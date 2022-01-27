import { BaseBuffer } from "../BaseRenderer.js";

const GL_BUFFER_TYPE = {
    'index': 'ELEMENT_ARRAY_BUFFER',
    'vertex': 'ARRAY_BUFFER',
    'uniform': 'UNIFORM_BUFFER'
}
export class WebGLBuffer extends BaseBuffer {
    /**
     *
     * @param { WebGLRenderer } context
     * @param { {data : Float32Array} } options
     */
    constructor(context, options) {
        super(context, options);

        this.size = options.size | 0;

        // can be allocated or not, but buffer is exist
        this._allocated = false;

        // preallocated buffer can change size
        this._fixed = this.size > 0;
    }

    /**
     * 
     * @param {Float32Array | Uint16Array} data 
     * @param {number} [start] - start of partial update 
     * @param {number} [end] - end of partial update 
     * @returns 
     */
    update(data, start, end) {
        /**
         * @type {WebGL2RenderingContext}
         */
        const gl = this.context.gl;
        const type = gl[GL_BUFFER_TYPE[this.type]] || gl.ARRAY_BUFFER;

        data = data || this._data;

        if (!this.buffer) {
            this.buffer = gl.createBuffer();
        }

        // when size is 
        if (this._fixed && !this._allocated) {
            
            gl.bindBuffer(type, this.buffer);
            // allocate buffer
            gl.bufferData(type, this.size, gl.DYNAMIC_DRAW);

            this._allocated = true;

            if (!data) {
                return;
            }
        }

        start = start || 0;
        end = end || data.length;

        let length = end - start;

        if (length <= 0 || this.size < end) {
            start = 0;
            length = data.length;
        }

        if (this._fixed && length > this.size) {
            throw new Error('[GlBuffer] Preallocated buffer cant be grown up');
        }

        gl.bindBuffer(type, this.buffer);

        // if buffer not allocated
        // allocate it from buffer data 
        if (!this._allocated) {
            gl.bufferData(type, data, 
                this.options.usage === 'static' 
                    ? gl.STATIC_DRAW 
                    : gl.DYNAMIC_DRAW
            );

            this.size = length;
            this._allocated = true;
        // sub data is fast but need will shure that buffer is not overflow
        } else {
            gl.bufferSubData(
                type,
                start * data.BYTES_PER_ELEMENT, 
                data,
                start,
                length
            );
        }

        super.update();
    }

    bind() {
        const {
            /**
             * @type {WebGL2RenderingContext}
             */
            gl
        } = this.context;

        if (this.dirty || !this.buffer) {
            this.update();
            return;
        }
        
        const type = gl[GL_BUFFER_TYPE[this.type]] || gl.ARRAY_BUFFER;

        gl.bindBuffer(type, this.buffer);
    }

    destroy() {
        if (!this.buffer) {
            return;
        }

        this.context.gl.deleteBuffer(this.buffer);
        this.context = null;
        this.buffer = null;
        this.options = null;
        this.data = null;

        this._allocated = false;
        this._fixed = false;
    }
}