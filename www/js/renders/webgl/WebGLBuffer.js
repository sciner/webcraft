import { BaseBuffer } from "../BaseRenderer.js";

export class WebGLBuffer extends BaseBuffer {
    /**
     *
     * @param { WebGLRenderer } context
     * @param { {data : Float32Array} } options
     */
    constructor(context, options) {
        super(context, options);

        this.buffer = null;
        this.lastLenght = 0;
    }

    update() {
        const  {
            /**
             * @type {WebGL2RenderingContext}
             */
            gl
        } = this.context;

        if (!this.buffer) {
            this.buffer = gl.createBuffer();
        }

        const type = this.index ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;

        gl.bindBuffer(type, this.buffer);

        if (this.lastLenght < this.data.length) {
            gl.bufferData(type, this.data, this.options.usage === 'static' ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW);
            this.lastLenght = this.data.length
        } else {
            gl.bufferSubData(type, 0, this.data);
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

        gl.bindBuffer(this.index ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, this.buffer);
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