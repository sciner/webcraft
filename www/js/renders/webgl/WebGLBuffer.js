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

        this.buffer = null;
        this.lastLength = 0;
    }

    update(data, start, end) {
        const  {
            /**
             * @type {WebGL2RenderingContext}
             */
            gl
        } = this.context;

        if (!this.buffer) {
            this.buffer = gl.createBuffer();
        }

        data = data || this._data;

        if (!data) {
            return;
        }

        start = start || 0;
        end = end || data.length
        length = end - start;

        let full = false;

        if (length <= 0 || this.lastLength < end) {
            start = 0;
            length = data.length;
            full = true;
        }

        const type = gl[GL_BUFFER_TYPE[this.type]] || gl.ARRAY_BUFFER;

        gl.bindBuffer(type, this.buffer);

        if (full) {
            gl.bufferData(type, data, 
                this.options.usage === 'static' 
                    ? gl.STATIC_DRAW 
                    : gl.DYNAMIC_DRAW,
                0, end
            );

            this.lastLength = end;
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
    }
}