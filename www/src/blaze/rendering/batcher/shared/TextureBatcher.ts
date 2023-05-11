import { MAX_TEXTURES } from './const.js';
import { optimizeBindings } from './optimizeBindings.js';

import type { BindableTexture } from '../../renderers/shared/texture/Texture.js';
import type { TextureBatch } from './Batcher.js';
import type {BindGroup} from "../../renderers/gpu/shader/BindGroup.js";

const batchPool: TextureBatchOutput[] = [];
let batchPoolIndex = 0;

class TextureBatchOutput
{
    textures: BindableTexture[] = [];
    size = 0;
    batchLocations: Record<number, number> = {};
    bindGroup?: BindGroup;
}

export class TextureBatcher
{
    textureTicks: Record<number, number> = {};

    tick = 1000;

    output: TextureBatchOutput;
    bindingOffset: number;

    begin()
    {
        batchPoolIndex = 0;

        this.bindingOffset = 0;
        this.reset();
    }

    reset()
    {
        this.tick++;

        this.output = batchPool[batchPoolIndex++] || new TextureBatchOutput();

        this.output.bindGroup = null;

        this.output.size = 0;
    }

    finish(previousBatch?: TextureBatch)
    {
        // TODO make sure to add empty textures to the batch.

        let output = this.output;

        // TODO this should never have length 0.. need to investigate..
        if (previousBatch && previousBatch.textures.length && output.textures.length)
        {
            output = optimizeBindings(previousBatch, output as any, this.tick, this.bindingOffset++) as any;
        }

        this.reset();

        return output;
    }

    add(texture: BindableTexture): boolean
    {
        const styleSourceKey = texture.styleSourceKey;
        const tick = this.tick;
        const textureTicks = this.textureTicks;

        if (textureTicks[styleSourceKey] === tick) return true;

        const output = this.output;

        if (output.size === MAX_TEXTURES) return false;

        output.textures[output.size] = texture;

        textureTicks[styleSourceKey] = tick;

        output.batchLocations[styleSourceKey] = output.size++;

        batchPoolIndex = 0;

        return true;
    }
}
