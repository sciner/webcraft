import type { BaseRenderer } from "../renders/BaseRenderer.js";
import { Buffer, Geometry, Renderer } from "vauxcel";
import { TerrainGeometry15 } from "./terrain_geometry_15.js";

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

export class BaseGeometryVao extends Geometry {
    [key: string]: any;
    static strideFloats = 10;

    strideFloats: number;
    stride: number;
    size: number;
    context: BaseRenderer;
    bufferType: VAO_BUFFER_TYPE;
    attribs: any = null;

    data: Float32Array = null;
    buffer: Buffer = null;
    hasInstance = false;
    newBuffer: Buffer = null;
    dataDirty = false;

    constructor({size = 128, strideFloats = 0, bufferType = VAO_BUFFER_TYPE.BIG}: GeometryVaoOptions) {
        super();
        this.strideFloats = strideFloats;
        this.stride = this.strideFloats * 4;
        this.size = size;
        this.bufferType = bufferType;
        if (bufferType !== VAO_BUFFER_TYPE.BIG) {
            this.data = new Float32Array(size * this.strideFloats);
        }
    }

    init(context: BaseRenderer) {
        this.context = context;
        this.initBuffer();
        this.initAttributes();
    }

    initBuffer() {
        if (this.bufferType == VAO_BUFFER_TYPE.BIG) {
            this.buffer = new Buffer(null, true);
            this.buffer.data = null;
            this.buffer.byteLength = this.size * this.stride;
        } else {
            this.buffer = new Buffer(this.data, false);
        }
    }

    initAttributes() {

    }

    validateResize(pixiRender: Renderer) {
        if (!this.newBuffer) {
            return;
        }
        pixiRender.geometry.swapAndCopyBuffer(this, 0, this.newBuffer);
        this.buffer.dispose();
        this.buffer = this.newBuffer;
        this.newBuffer = null;
    }

    resize(instances) {
        if (this.bufferType === VAO_BUFFER_TYPE.BIG) {
            if (Object.keys(this.buffer._glBuffers).length > 0) {
                if (!this.newBuffer) {
                    this.newBuffer = new Buffer(null, true);
                }
                this.newBuffer.byteLength = instances * this.stride;
            } else {
                this.buffer.byteLength = instances * this.stride;
            }
        } else {
            const oldData = this.data;
            this.data = new Float32Array(instances * this.strideFloats);
            this.data.set(oldData, 0);
            this.buffer.update(this.data);
        }
        this.size = instances;
    }

    drawBindCount: number = 0;

    /**
     * Only bind for drawing, no actual upload!
     * @param shader
     */
    bindForDraw() {
        this.drawBindCount++;
        this.context.pixiRender.geometry.bind(this);
    }

    bind() {
        this.bindForDraw();
    }

    destroy() {
        super.destroy();
    }
}
