import { ExtensionType } from '../../../extensions/Extensions';
import { BatchableSprite } from './BatchSprite';

import type { ExtensionMetadata } from '../../../extensions/Extensions';
import type { InstructionSet } from '../../renderers/shared/instructions/InstructionSet';
import type { ISystem } from '../../renderers/shared/system/ISystem';
import type { Renderer } from '../../renderers/types';
import type { SpriteRenderable } from './SpriteRenderable';

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
