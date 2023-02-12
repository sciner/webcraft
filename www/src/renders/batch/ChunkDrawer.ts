import {ObjectDrawer} from "./ObjectDrawer.js";
import {ChunkBatch} from "./ChunkBatch.js";
import {ViewableBuffer} from "./ViewableBuffer.js";

/**
 * util
 */
export function nextPow2(v)
{
    v += v === 0 ? 1 : 0;
    --v;
    v |= v >>> 1;
    v |= v >>> 2;
    v |= v >>> 4;
    v |= v >>> 8;
    v |= v >>> 16;

    return v + 1;
}

/**
 * PixiJS BatchRenderer for chunk array
 */
export class ChunkDrawer extends ObjectDrawer {
    constructor(context) {
        super(context);

        this.elements = [];
        this.elementCount = 0;
        this.batches = [];
        this.batchCount = 0;

        this._aBuffers = {};

        this.settings = {
            maxLightTextures: 1,
            maxChunks: 16
        }
    }

    getAttributeBuffer(size)
    {
        // 1 float per instanced quad
        // holds chunk number
        const roundedSize = nextPow2(size);
        let buffer = this._aBuffers[roundedSize];

        if (!buffer)
        {
            this._aBuffers[roundedSize] = buffer = new ViewableBuffer(roundedSize * 4);
        }

        return buffer;
    }

    draw(geom, material, chunk) {
        if (geom.size === 0) {
            return;
        }
        // if (!this.batches[this.batchCount]) {
        //     this.batches[this.batchCount++] = new ChunkBatch();
        // }
    }

    buildTexturesAndDrawCalls()
    {

    }

    drawBatches() {

    }

    flush() {

    }
}
