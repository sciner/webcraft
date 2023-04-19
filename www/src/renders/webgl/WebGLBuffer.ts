import {BaseBuffer} from "../BaseRenderer.js";
import type {IvanArray} from "../../helpers";
import type {GeomCopyOperation} from "../../geom/big_geom_batch_update";

export class WebGLBuffer extends BaseBuffer {
    /**
     * length of last uploaded buffer to webgl, in bytes
     */
    glLength = 0;
    buffer: WebGLBuffer = null;
    glTrySubData = true;

    update(loc?: number) {
        if (this.bigLength > 0) {
            this.updateBig(loc);
            return;
        }

        const { gl } = this.context;

        if (!this.buffer) {
            this.buffer = gl.createBuffer();
        }

        loc = loc ?? (this.index ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER)

        gl.bindBuffer(loc, this.buffer);
        if (this.glLength < this.data.byteLength || !this.glTrySubData) {
            gl.bufferData(loc, this.data, this.options.usage === 'static' ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW);
            this.glLength = this.data.byteLength
        } else {
            gl.bufferSubData(loc, 0, this.data);
        }

        super.update();
    }

    updateBig(loc?: number) {
        const { gl } = this.context;
        loc = loc ?? (this.index ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER);
        let oldBuf: WebGLBuffer = null;
        if (this.glLength > 0) {
            oldBuf = this.buffer;
            this.buffer = gl.createBuffer();
            gl.bindBuffer(gl.COPY_READ_BUFFER, oldBuf);
        } else {
            this.buffer = gl.createBuffer();
        }
        gl.bindBuffer(loc, this.buffer);
        gl.bufferData(loc, this.bigLength, gl.STATIC_COPY);
        if (oldBuf) {
            this.bigResize = true;
            gl.copyBufferSubData(gl.COPY_READ_BUFFER, loc, 0, 0, this.glLength);
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

    bind(loc?: number) {
        const {
            /**
             * @type {WebGL2RenderingContext}
             */
            gl
        } = this.context;

        loc = loc ?? (this.index ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER)

        if (this.dirty || !this.buffer) {
            this.update(loc);
            return;
        }

        gl.bindBuffer(loc, this.buffer);
    }

    batchUpdate(updBuffer: BaseBuffer, copies: IvanArray<GeomCopyOperation>, stride: number) {
        const {gl} = this.context;

        const loc = gl.COPY_WRITE_BUFFER;
        this.bind(loc);
        updBuffer.bind(gl.COPY_READ_BUFFER);
        for (let i = 0; i < copies.count; i++) {
            const op = copies.arr[i];
            gl.copyBufferSubData(gl.COPY_READ_BUFFER, loc,
                op.src * stride, op.dst * stride, op.count * stride);
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