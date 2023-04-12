import type BaseRenderer from "../renders/BaseRenderer.js";
import type {BaseBuffer} from "../renders/BaseRenderer.js";
import GeometryTerrain from "../geometry_terrain.js";

export enum VAO_BUFFER_TYPE {
    NONE = 0,
    BIG = 1,
    DYNAMIC = 2
}

export interface GeometryVaoOptions {
    context?: BaseRenderer,
    size?: number,
    strideFloats?: number,
    bufferType?: VAO_BUFFER_TYPE,
}

export class BaseGeometryVao {
    static strideFloats = 10;

    strideFloats: number;
    stride: number;
    size: number;
    context: BaseRenderer;
    bufferType: VAO_BUFFER_TYPE;
    attribs: any = null;
    gl: WebGL2RenderingContext = null;

    data: Float32Array = null;
    buffer: BaseBuffer = null;
    quad: BaseBuffer = null;
    vao: WebGLVertexArrayObject = null;
    buffers: BaseBuffer[] = [];
    hasInstance = false;
    indexBuffer?: BaseBuffer = null;

    constructor({size = 128, strideFloats = 0, bufferType = VAO_BUFFER_TYPE.BIG}: GeometryVaoOptions) {
        this.strideFloats = strideFloats;
        this.stride = this.strideFloats * 4;
        this.size = size;
        this.bufferType = bufferType;
        if (bufferType !== VAO_BUFFER_TYPE.BIG) {
            this.data = new Float32Array(size * this.strideFloats);
        }
    }

    init(shader) {
        if (this.context) {
            return;
        }
        this.attribs = shader;
        this.context = shader.context;
        // when WebGL
        this.gl = shader.context.gl;

        if (this.bufferType == VAO_BUFFER_TYPE.BIG) {
            this.buffer = this.context.createBuffer({
                usage: 'static',
                bigLength: this.size * this.stride,
            });
        } else {
            this.buffer = this.context.createBuffer({
                usage: 'dynamic',
                data: this.data,
            });
        }

        (this.buffer as any).glTrySubData = false;
        // this.data = null;

        if (this.hasInstance) {
            this.quad = GeometryTerrain.bindQuad(this.context, true);
            this.buffers = [
                this.buffer,
                this.quad
            ];
        }

        this.createVao();
    }

    resize(instances) {
        if (this.bufferType === VAO_BUFFER_TYPE.BIG) {
            this.buffer.bigLength = instances * this.stride;
            this.buffer.dirty = true;
        } else {
            const oldData = this.data;
            this.data = new Float32Array(instances * this.strideFloats);
            this.data.set(oldData, 0);
            this.buffer.data = this.data;
        }
        this.size = instances;
    }

    drawBindCountSync: number = 0;
    drawBindCount: number = 0;
    drawSync: WebGLSync = null;
    copyFlag = false;

    /**
     * Only bind for drawing, no actual upload!
     * @param shader
     */
    bindForDraw() {
        this.drawBindCount++;
        this.gl.bindVertexArray(this.vao);
        if (this.buffer.bigResize) {
            this.buffer.bigResize = false;
            // shader.bind();
            this.buffer.bind();
            this.attribBufferPointers();
        } else if (this.buffer.dirty || this.hasInstance && !this.context.multidrawBaseExt) {
            this.buffer.bind();
        }
        this.indexBuffer?.bind();
    }

    bind() {
        this.bindForDraw();
    }

    checkFence(force = false) {
        if (this.drawBindCountSync === this.drawBindCount && !force) {
            return;
        }
        this.drawBindCountSync = this.drawBindCount;
        const { gl } = this;
        if (this.drawSync) {
            gl.deleteSync(this.drawSync);
        }
        this.drawSync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    }

    isSynced() {
        const { gl } = this;
        return !this.drawSync ||
            gl.getSyncParameter(this.drawSync, gl.SYNC_STATUS) === gl.SIGNALED;
    }

    createVao() {
        // override!
    }

    attribBufferPointers(offsetInstances= 0) {
        // override!
    }

    destroy() {
        // we not destroy it, it shared
        this.quad = null;

        if (this.buffer) {
            this.buffer.destroy();
            this.buffer = null;
        }

        if (this.vao) {
            this.gl.deleteVertexArray(this.vao);
            this.vao = null;
        }
    }
}
