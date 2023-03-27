import {BaseBuffer} from "../BaseRenderer.js";
import type {GeomCopyOperation} from "../../geom/big_geom_batch_update";

export class WebGLBuffer extends BaseBuffer {
    [key: string]: any;

    /**
     *
     * @param { WebGLRenderer } context
     * @param { {data : Float32Array} } options
     */
    constructor(context, options) {
        super(context, options);

        this.buffer = null;
        /**
         * length of last uploaded buffer to webgl, in bytes
         */
        this.glLength = 0;
    }

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

    batchUpdate(updateBuffer: BaseBuffer, copies: Array<GeomCopyOperation>, stride: number) {
        const {gl} = this.context;

        for (let i = 0; i < copies.length; i++) {
            const op = copies[i];
            gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER,
                op.srcInstance * stride, op.destInstance * stride, op.size * stride);
        }
    }

    multiUpdate(segments, perBuffer = 4096) {
        const {gl} = this.context;
        let size = 0;
        let start = 0;
        let cnt = 0;
        while (start < segments.length) {
            let finish = start + 2;
            while (finish < segments.length && segments[finish] - segments[finish - 1] <= perBuffer) {
                finish += 2;
            }
            let len = segments[finish - 1] - segments[start];
            gl.bufferSubData(gl.ARRAY_BUFFER, segments[start] * 4, this.data, segments[start], len);
            size += len;
            cnt++;
            start = finish;
        }
        console.debug(`multiupdate ${cnt} ${size}`)
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