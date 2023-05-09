import { ExtensionType } from '../../../extensions/Extensions';

import type { ExtensionMetadata } from '../../../extensions/Extensions';
import type { InstructionSet } from '../../renderers/shared/instructions/InstructionSet';
import type { RenderablePipe } from '../../renderers/shared/instructions/RenderPipe';
import type { Renderer } from '../../renderers/types';
import type { SpriteRenderable } from './SpriteRenderable';
import type { SpriteSystem } from './SpriteSystem';

let spriteSystem: SpriteSystem = null;

export class SpritePipe implements RenderablePipe<SpriteRenderable>
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererPipes,
            ExtensionType.WebGPURendererPipes,
            ExtensionType.CanvasRendererPipes,
        ],
        name: 'sprite',
    };

    instructionSet: InstructionSet;
    renderer: Renderer;

    spriteSystem: SpriteSystem;

    constructor(renderer: Renderer)
    {
        this.renderer = renderer;
    }

    init()
    {
        spriteSystem = this.renderer.sprite;
    }

    bind(instructionSet: InstructionSet)
    {
        this.instructionSet = instructionSet;
    }

    addRenderable(renderable: SpriteRenderable)
    {
        const gpuSprite = spriteSystem.getGpuSprite(renderable);

        this.renderer.renderPipes.batch.addToBatch(gpuSprite, renderable.visible);
    }

    updateRenderable(renderable: SpriteRenderable)
    {
        const gpuSprite = spriteSystem.getGpuSprite(renderable);

        gpuSprite.batch.updateElement(gpuSprite);
    }

    updateVisibility(renderable: SpriteRenderable)
    {
        if (!renderable.visible)
        {
            const gpuSprite = spriteSystem.getGpuSprite(renderable);

            gpuSprite.batch.hideElement(gpuSprite);
        }
    }

    validateRenderable(renderable: SpriteRenderable): boolean
    {
        const texture = renderable._texture;
        const gpuSprite = spriteSystem.getGpuSprite(renderable);

        if (gpuSprite.texture !== texture)
        {
            gpuSprite.texture = texture;

            const canUse = gpuSprite.batch.checkCanUseTexture(gpuSprite);

            if (!canUse)
            {
                return true;
            }
        }

        return false;
    }
}
