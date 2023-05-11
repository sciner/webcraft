import { ExtensionType } from '../../../extensions/Extensions.js';
import { BatchableSprite } from './BatchSprite.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { InstructionSet } from '../../renderers/shared/instructions/InstructionSet.js';
import type { ISystem } from '../../renderers/shared/system/ISystem.js';
import type { Renderer } from '../../renderers/types.js';
import type { SpriteRenderable } from './SpriteRenderable.js';

const gpuSpriteHash: Record<number, BatchableSprite> = {};

export class SpriteSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererSystem,
            ExtensionType.WebGPURendererSystem,
            ExtensionType.CanvasRendererSystem,
        ],
        name: 'sprite',
    };

    instructionSet: InstructionSet;
    renderer: Renderer;

    constructor(renderer: Renderer)
    {
        this.renderer = renderer;
    }

    getGpuSprite(renderable: SpriteRenderable): BatchableSprite
    {
        return gpuSpriteHash[renderable.uid] || this.initGPUSprite(renderable);
    }

    initGPUSprite(renderable: SpriteRenderable): BatchableSprite
    {
        const gpuSprite: BatchableSprite = new BatchableSprite();

        gpuSprite.renderable = renderable;
        gpuSprite.texture = renderable._texture;
        gpuSprite.bounds = renderable.bounds;

        gpuSpriteHash[renderable.uid] = gpuSprite;

        return gpuSprite;
    }

    destroy()
    {
        // boom!
    }
}
