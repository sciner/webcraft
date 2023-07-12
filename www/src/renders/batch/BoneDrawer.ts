import {ViewableBuffer, Renderer} from "vauxcel";
import {ObjectDrawer} from "./ObjectDrawer.js";
import {nextPow2} from "./ObjectDrawer.js";

export class BoneDrawer extends ObjectDrawer {
    elements = [];
    elementCount = 0;
    batches = [];
    batchCount = 0;

    _aBuffers: Record<number, ViewableBuffer> = {};
    settings: any;

    constructor(renderer: Renderer) {
        super(renderer);

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

    flush() {

    }
}