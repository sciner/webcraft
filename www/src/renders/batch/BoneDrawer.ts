import {ViewableBuffer, Renderer, ExtensionType} from "vauxcel";
import {ObjectDrawer} from "./ObjectDrawer.js";
import {nextPow2} from "./ObjectDrawer.js";
import {BoneBufferSet, IBoneBatcherSettings} from "./BoneBatcher.js";

export class BoneDrawer extends ObjectDrawer {
    static extension = {
        name: 'bone',
        type: ExtensionType.RendererPlugin,
    };

    elements = [];
    elementCount = 0;
    batches = [];
    batchCount = 0;

    _aBuffers: Record<number, ViewableBuffer> = {};
    settings: IBoneBatcherSettings;
    zero_bone_group: BoneBufferSet;

    constructor(renderer: Renderer) {
        super(renderer);

        this._aBuffers = {};

        this.settings = {
            // 12 floats
            bone_count: 128,
            // 3 floats
            pos_count: 512,
            // 4 floats
            tint_count: 128,
            multiplier: 10
        }

        this.zero_bone_group = new BoneBufferSet({...this.settings, multiplier: 1});
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