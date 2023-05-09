import { ExtensionType } from '../../../extensions/Extensions';
import { STENCIL_MODES } from '../../renderers/shared/state/const';

import type { ExtensionMetadata } from '../../../extensions/Extensions';
import type { Instruction } from '../../renderers/shared/instructions/Instruction';
import type { InstructionSet } from '../../renderers/shared/instructions/InstructionSet';
import type { InstructionGenerator, InstructionRunner } from '../../renderers/shared/instructions/RenderPipe';
import type { Renderer } from '../../renderers/types';
import type { StencilMask } from './StencilMask';

type MaskMode = 'pushMaskBegin' | 'pushMaskEnd' | 'popMaskBegin' | 'popMaskEnd';

export interface StencilMaskInstruction extends Instruction
{
    type: 'stencilMask',
    action: MaskMode,
    mask: StencilMask,
}

export class StencilMaskPipe implements InstructionRunner<StencilMaskInstruction>, InstructionGenerator
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererPipes,
            ExtensionType.WebGPURendererPipes,
            ExtensionType.CanvasRendererPipes,
        ],
        name: 'stencilMask',
    };

    instructionSet: InstructionSet;
    renderer: Renderer;

    // used when building and also when executing..
    // TODO perhaps we can hard code the value for execution?
    // TODO stacks need to exist on each render target..
    maskStack = 0;

    maskHash = new WeakMap<StencilMask, {
        instructionsStart: number,
        instructionsLength: number,
    }>();

    constructor(renderer: Renderer)
    {
        this.renderer = renderer;
    }

    bind(instructionSet: InstructionSet)
    {
        this.instructionSet = instructionSet;
    }

    push(mask: StencilMask): void
    {
        const { renderer, instructionSet } = this;

        renderer.renderPipes.batch.break();

        instructionSet.addInstruction({
            type: 'stencilMask',
            action: 'pushMaskBegin',
            mask,
            canBundle: false,
        } as StencilMaskInstruction);

        const maskContainer = mask.mask;

        maskContainer.includeInBuild = true;

        if (!this.maskHash.has(mask))
        {
            this.maskHash.set(mask, {
                instructionsStart: 0,
                instructionsLength: 0,
            });
        }

        const maskData = this.maskHash.get(mask);

        maskData.instructionsStart = instructionSet.instructionSize;

        renderer.builder.collectAllRenderables(
            maskContainer,
            instructionSet,
            0,
            renderer
        );

        maskContainer.includeInBuild = false;
        maskContainer.isRenderable = true;

        renderer.renderPipes.batch.break();

        instructionSet.addInstruction({
            type: 'stencilMask',
            action: 'pushMaskEnd',
            mask,
            canBundle: false,
        } as StencilMaskInstruction);

        const instructionsLength = instructionSet.instructionSize - maskData.instructionsStart - 1;

        maskData.instructionsLength = instructionsLength;

        this.maskStack++;
    }

    pop(mask: StencilMask): void
    {
        this.maskStack--;

        const { renderer, instructionSet } = this;

        renderer.renderPipes.batch.break();

        instructionSet.addInstruction({
            type: 'stencilMask',
            action: 'popMaskBegin',
            canBundle: false,
        });

        const maskData = this.maskHash.get(mask);

        if (this.maskStack)
        {
            for (let i = 0; i < maskData.instructionsLength; i++)
            {
                // eslint-disable-next-line max-len
                instructionSet.instructions[instructionSet.instructionSize++] = instructionSet.instructions[maskData.instructionsStart++];
            }
        }

        instructionSet.addInstruction({
            type: 'stencilMask',
            action: 'popMaskEnd',
            canBundle: false,
        });
    }

    execute(instruction: StencilMaskInstruction)
    {
        const renderer = this.renderer;

        if (instruction.action === 'pushMaskBegin')
        {
            this.maskStack++;
            renderer.stencil.setStencilMode(STENCIL_MODES.RENDERING_MASK, this.maskStack);
            renderer.colorMask.setMask(0);
        }
        else if (instruction.action === 'pushMaskEnd')
        {
            renderer.stencil.setStencilMode(STENCIL_MODES.MASK_ACTIVE, this.maskStack);
            renderer.colorMask.setMask(0xF);
        }
        else if (instruction.action === 'popMaskBegin')
        {
            this.maskStack--;

            if (this.maskStack !== 0)
            {
                renderer.stencil.setStencilMode(STENCIL_MODES.RENDERING_MASK, this.maskStack);
                renderer.colorMask.setMask(0);
            }
        }
        else if (instruction.action === 'popMaskEnd')
        {
            if (this.maskStack === 0)
            {
                renderer.stencil.setStencilMode(STENCIL_MODES.DISABLED, this.maskStack);
            }
            else
            {
                renderer.stencil.setStencilMode(STENCIL_MODES.MASK_ACTIVE, this.maskStack);
            }

            renderer.colorMask.setMask(0xF);
        }
    }
}
