import {BaseBuffer} from "../BaseRenderer.js";
import type {GeomCopyOperation} from "../../geom/big_geom_batch_update.js";

export class WebGLBuffer extends BaseBuffer {
    /**
     * length of last uploaded buffer to webgl, in bytes
     */
    glLength = 0;
    buffer: WebGLBuffer = null;

    update() {
        if (this.bigLength > 0) {
            this.updateBig();
            return;
        }

        const { gl } = this.context;

        if (!this.buffer) {
            this.buffer = gl.createBuffer();
        }

        const type = this.index ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;

        gl.bindBuffer(type, this.buffer);
        if (this.glLength < this.data.byteLength) {
            gl.bufferData(type, this.data, this.options.usage === 'static' ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW);
            this.glLength = this.data.byteLength
        } else {
            gl.bufferSubData(type, 0, this.data);
        }

        super.update();
    }

    updateBig() {
        const { gl } = this.context;
        const type = this.index ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
        let oldBuf: WebGLBuffer = null;
        if (this.glLength > 0) {
            oldBuf = this.buffer;
            this.buffer = gl.createBuffer();
            gl.bindBuffer(gl.COPY_READ_BUFFER, oldBuf);
        } else {
            this.buffer = gl.createBuffer();
        }
        gl.bindBuffer(type, this.buffer);
        gl.bufferData(type, this.bigLength, gl.STATIC_DRAW);
        if (oldBuf) {
            gl.copyBufferSubData(gl.COPY_READ_BUFFER, type, 0, 0, this.glLength);
            gl.deleteBuffer(oldBuf);
        }
        this.glLength = this.bigLength;
        super.update();
    }

    updatePartial(len) {
        const {
            gl
        } = this.context;

        if (!this.buffer) {
            this.buffer = gl.createBuffer();
        }

        const type = this.index ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;

        gl.bindBuffer(type, this.buffer);

        if (this.glLength < this.data.byteLength) {
            gl.bufferData(type, this.data, this.options.usage === 'static' ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW);
            this.glLength = this.data.byteLength
        } else {
            gl.bufferSubData(type, 0, this.data, 0, len);
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

    batchUpdate(updateBuffer: BaseBuffer, copies: Array<GeomCopyOperation>, count: number, stride: number) {
        const {gl} = this.context;

        this.bind();
        gl.bindBuffer(gl.COPY_READ_BUFFER, (updateBuffer as WebGLBuffer).buffer);
        for (let i = 0; i < count; i++) {
            const op = copies[i];
            gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.ARRAY_BUFFER,
                op.srcInstance * stride, op.destInstance * stride, op.size * stride);
        }
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