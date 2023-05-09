import { ExtensionType } from '../../../extensions/Extensions';
import { BigPool } from '../../../utils/pool/PoolGroup';
import { FilterEffect } from '../../filters/FilterEffect';
import { MaskFilter } from '../../filters/mask/MaskFilter';
import { Texture } from '../../renderers/shared/texture/Texture';
import { Bounds } from '../../scene/bounds/Bounds';
import { getGlobalBounds } from '../../scene/bounds/getGlobalBounds';
import { Sprite } from '../../sprite/shared/Sprite';

import type { ExtensionMetadata } from '../../../extensions/Extensions';
import type { PoolItem } from '../../../utils/pool/Pool';
import type { Instruction } from '../../renderers/shared/instructions/Instruction';
import type { InstructionSet } from '../../renderers/shared/instructions/InstructionSet';
import type { InstructionGenerator, InstructionRunner } from '../../renderers/shared/instructions/RenderPipe';
import type { RenderTarget } from '../../renderers/shared/renderTarget/RenderTarget';
import type { Renderer } from '../../renderers/types';
import type { Container } from '../../scene/Container';
import type { AlphaMask } from './AlphaMask';

type MaskMode = 'pushMaskBegin' | 'pushMaskEnd' | 'popMaskBegin' | 'popMaskEnd';

const tempBounds = new Bounds();

class AlphaMaskEffect extends FilterEffect implements PoolItem
{
    constructor()
    {
        super({
            filters: [new MaskFilter({
                sprite: new Sprite(Texture.EMPTY)
            })]
        });
    }

    get sprite(): Sprite
    {
        return (this.filters[0] as MaskFilter).sprite;
    }

    set sprite(value: Sprite)
    {
        (this.filters[0] as MaskFilter).sprite = value;
    }

    init: () => void;
}

export interface AlphaMaskInstruction extends Instruction
{
    type: 'alphaMask',
    action: MaskMode,
    mask: AlphaMask,
    maskedContainer: Container,
    renderMask: boolean,
}

export interface AlphaMaskData
{
    filterEffect: AlphaMaskEffect,
    maskedContainer: Container,
    previousRenderTarget?: RenderTarget,
    filterTexture?: Texture,
}

export class AlphaMaskPipe implements InstructionRunner<AlphaMaskInstruction>, InstructionGenerator
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererPipes,
            ExtensionType.WebGPURendererPipes,
            ExtensionType.CanvasRendererPipes,
        ],
        name: 'alphaMask',
    };

    instructionSet: InstructionSet;
    renderer: Renderer;
    activeMaskStage: AlphaMaskData[] = [];

    constructor(renderer: Renderer)
    {
        this.renderer = renderer;
    }

    bind(instructionSet: InstructionSet)
    {
        this.instructionSet = instructionSet;
    }

    push(mask: AlphaMask, maskedContainer: Container): void
    {
        const { renderer, instructionSet } = this;

        renderer.renderPipes.batch.break();

        instructionSet.addInstruction({
            type: 'alphaMask',
            action: 'pushMaskBegin',
            mask,
            canBundle: false,
            maskedContainer
        } as AlphaMaskInstruction);

        if (mask.renderMaskToTexture)
        {
            const maskContainer = mask.mask;

            maskContainer.includeInBuild = true;

            renderer.builder.collectAllRenderables(
                maskContainer,
                instructionSet,
                0,
                renderer
            );

            maskContainer.includeInBuild = false;
        }

        renderer.renderPipes.batch.break();

        instructionSet.addInstruction({
            type: 'alphaMask',
            action: 'pushMaskEnd',
            mask,
            maskedContainer,
            canBundle: false,
        } as AlphaMaskInstruction);
    }

    pop(mask: AlphaMask): void
    {
        const { renderer, instructionSet } = this;

        renderer.renderPipes.batch.break();

        instructionSet.addInstruction({
            type: 'alphaMask',
            action: 'popMaskEnd',
            mask,
            canBundle: false,
        } as AlphaMaskInstruction);
    }

    execute(instruction: AlphaMaskInstruction)
    {
        const renderer = this.renderer;
        const renderMask = instruction.mask.renderMaskToTexture;

        if (instruction.action === 'pushMaskBegin')
        {
            const filterEffect = BigPool.get(AlphaMaskEffect);

            if (renderMask)
            {
                instruction.mask.mask.measurable = true;

                const bounds = getGlobalBounds(instruction.mask.mask, true, tempBounds);

                instruction.mask.mask.measurable = false;

                bounds.ceil();

                const filterTexture = renderer.texturePool.push(bounds, 1, false);

                const sprite = filterEffect.sprite;

                sprite.texture = filterTexture;

                sprite.worldTransform.tx = bounds.minX;
                sprite.worldTransform.ty = bounds.minY;

                this.activeMaskStage.push({

                    filterEffect,
                    maskedContainer: instruction.maskedContainer,
                    filterTexture,
                });
            }
            else
            {
                filterEffect.sprite = instruction.mask.mask as Sprite;

                this.activeMaskStage.push({
                    filterEffect,
                    maskedContainer: instruction.maskedContainer,
                });
            }
        }
        else if (instruction.action === 'pushMaskEnd')
        {
            const maskData = this.activeMaskStage[this.activeMaskStage.length - 1];

            if (renderMask)
            {
                renderer.texturePool.pop();
            }

            renderer.renderPipes.filter.pushFilterAction({
                type: 'filter',
                action: 'pushFilter',
                container: maskData.maskedContainer,
                filterEffect: maskData.filterEffect,
                canBundle: false,
            });
        }
        else if (instruction.action === 'popMaskEnd')
        {
            renderer.renderPipes.filter.popFilterAction();

            const maskData = this.activeMaskStage.pop();

            if (renderMask)
            {
                renderer.texturePool.returnTexture(maskData.filterTexture);
            }

            BigPool.return(maskData.filterEffect);
        }
    }
}
