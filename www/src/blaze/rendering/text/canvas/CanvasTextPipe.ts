import { ExtensionType } from '../../../extensions/Extensions';
import { SpriteRenderable } from '../../sprite/shared/SpriteRenderable';

import type { ExtensionMetadata } from '../../../extensions/Extensions';
import type { InstructionSet } from '../../renderers/shared/instructions/InstructionSet';
import type { RenderablePipe } from '../../renderers/shared/instructions/RenderPipe';
import type { Texture } from '../../renderers/shared/texture/Texture';
import type { Renderer } from '../../renderers/types';
import type { TextRenderable } from '../TextRenderable';

export class CanvasTextPipe implements RenderablePipe<TextRenderable>
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererPipes,
            ExtensionType.WebGPURendererPipes,
            ExtensionType.CanvasRendererPipes,
        ],
        name: 'text',
    };

    instructionSet: InstructionSet;
    renderer: Renderer;

    gpuText: Record<string, {
        texture: Texture,
        currentKey: string,
        spriteRenderable: SpriteRenderable,
    }> = {};

    constructor(renderer: Renderer)
    {
        this.renderer = renderer;
    }

    validateRenderable(renderable: TextRenderable): boolean
    {
        const gpuText = this.getGpuText(renderable);

        const newKey = renderable.getKey();

        if (gpuText.currentKey !== newKey)
        {
            this.renderer.canvasText.decreaseReferenceCount(gpuText.currentKey);

            const resolution = renderable._autoResolution ? this.renderer.view.resolution : renderable._resolution;

            const texture = this.renderer.canvasText.getTexture(
                renderable.text,
                resolution,
                renderable._style,
                newKey
            );

            gpuText.currentKey = newKey;

            if (texture !== gpuText.texture)
            {
                gpuText.texture = texture;

                gpuText.spriteRenderable.texture = texture;

                return true;
            }
        }

        gpuText.spriteRenderable.boundsDirty = true;
        gpuText.spriteRenderable.anchor.x = renderable.anchor.x;
        gpuText.spriteRenderable.anchor.y = renderable.anchor.y;

        return false;
    }

    bind(instructionSet: InstructionSet)
    {
        this.instructionSet = instructionSet;
    }

    addRenderable(renderable: TextRenderable)
    {
        const { spriteRenderable } = this.getGpuText(renderable);

        spriteRenderable.visible = renderable.visible;

        this.renderer.instructions.buildAdd(spriteRenderable);
    }

    updateRenderable(renderable: TextRenderable)
    {
        const spriteRenderable = this.getGpuText(renderable).spriteRenderable;

        this.renderer.renderPipes.sprite.updateRenderable(spriteRenderable);
    }

    updateVisibility(renderable: TextRenderable)
    {
        const { spriteRenderable } = this.getGpuText(renderable);

        spriteRenderable.visible = renderable.visible;

        this.renderer.renderPipes.sprite.updateVisibility(spriteRenderable);
    }

    getGpuText(renderable: TextRenderable)
    {
        return this.gpuText[renderable.uid] || this.initGpuText(renderable);
    }

    initGpuText(renderable: TextRenderable)
    {
        renderable._style.update();

        const resolution = renderable._autoResolution ? this.renderer.view.resolution : renderable._resolution;

        const texture = this.renderer.canvasText.getTexture(
            renderable.text,
            resolution,
            renderable._style,
            renderable.getKey()
        );

        const gpuTextData = {
            texture,
            currentKey: renderable.getKey(),
            spriteRenderable: new SpriteRenderable(texture, renderable.data)
        };

        // map the anchor property to the text..
        gpuTextData.spriteRenderable.anchor.x = renderable.anchor.x;
        gpuTextData.spriteRenderable.anchor.y = renderable.anchor.y;

        this.gpuText[renderable.uid] = gpuTextData;

        return gpuTextData;
    }
}
