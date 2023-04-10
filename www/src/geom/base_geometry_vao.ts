import type BaseRenderer from "../renders/BaseRenderer.js";
import type {BaseBuffer} from "../renders/BaseRenderer.js";
import GeometryTerrain from "../geometry_terrain";

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

    indexData: Int32Array;
    buffer: BaseBuffer = null;
    indexBuffer: BaseBuffer = null;
    quad: BaseBuffer = null;
    vao: WebGLVertexArrayObject = null;
    buffers: BaseBuffer[] = [];
    hasInstance = false;

    constructor({size = 128, strideFloats = 0, bufferType = VAO_BUFFER_TYPE.BIG}: GeometryVaoOptions) {
        this.strideFloats = strideFloats;
        this.stride = this.strideFloats * 4;
        this.size = size;
        this.bufferType = bufferType;
    }

    /**
     * Only bind, no upload!
     * bind is handled is special of geometry itself
     * @param shader
     */
    bind(shader) {
        if (shader) {
            this.attribs = shader;
            this.context = shader.context;
            // when WebGL
            this.gl = shader.context.gl;
        }

        if (!this.buffer) {
            this.buffer = this.context.createBuffer({
                usage: 'dynamic',
                bigLength: this.size * this.stride,
            });
            // this.data = null;

            if (this.hasInstance) {
                this.quad = GeometryTerrain.bindQuad(this.context, true);
                this.buffers = [
                    this.buffer,
                    this.quad
                ];
            } else {
                //TODO
            }
        }

        const {gl} = this;

        if (gl) {
            if (!this.vao) {
                this.createVao();
                return;
            }

            gl.bindVertexArray(this.vao);
        }
    }

    createVao() {
        // override!
    }

    attribBufferPointers(offsetInstances= 0) {
        // override!
    }
}
