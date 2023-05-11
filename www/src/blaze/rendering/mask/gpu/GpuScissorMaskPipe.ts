import { ExtensionType } from '../../../extensions/Extensions.js';
import { Bounds } from '../../scene/bounds/Bounds.js';
import { getGlobalBounds } from '../../scene/bounds/getGlobalBounds.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { WebGPURenderer } from '../../renderers/gpu/WebGPURenderer.js';
import type { Instruction } from '../../renderers/shared/instructions/Instruction.js';
import type { InstructionSet } from '../../renderers/shared/instructions/InstructionSet.js';
import type { InstructionGenerator, InstructionRunner } from '../../renderers/shared/instructions/RenderPipe.js';
import type { AlphaMask } from '../shared/AlphaMask.js';
import type { ScissorMask } from '../shared/ScissorMask.js';

type MaskMode = 'pushMaskBegin' | 'pushMaskEnd' | 'popMaskBegin' | 'popMaskEnd';

export interface ScissorMaskInstruction extends Instruction
{
    type: 'scissorMask',
    action: MaskMode,
    mask: ScissorMask
}

const tempBounds = new Bounds();

export class GpuScissorMaskPipe implements InstructionRunner<ScissorMaskInstruction>, InstructionGenerator
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGPURendererPipes,
        ],
        name: 'scissorMask',
    };
    instructionSet: InstructionSet;
    renderer: WebGPURenderer;

    constructor(renderer: WebGPURenderer)
    {
        this.renderer = renderer;
    }

    bind(instructionSet: InstructionSet)
    {
        this.instructionSet = instructionSet;
    }

    push(mask: AlphaMask): void
    {
        const { renderer, instructionSet } = this;

        renderer.renderPipes.batch.break();

        instructionSet.addInstruction({
            type: 'scissorMask',
            action: 'pushMaskBegin',
            mask,
            canBundle: false,
        } as ScissorMaskInstruction);
    }

    pop(): void
    {
        const { renderer, instructionSet } = this;

        renderer.renderPipes.batch.break();

        instructionSet.addInstruction({
            type: 'scissorMask',
            action: 'popMaskEnd',
            canBundle: false,
        });
    }

    execute(instruction: ScissorMaskInstruction)
    {
        const renderer = this.renderer;

        if (instruction.action === 'pushMaskBegin')
        {
            instruction.mask.mask.isMask = false;

            const bounds = getGlobalBounds(instruction.mask.mask, true, tempBounds);

            instruction.mask.mask.isMask = true;

            bounds.ceil();

            renderer.encoder.setScissor(bounds);
        }
        else if (instruction.action === 'popMaskEnd')
        {
            renderer.encoder.clearScissor();
        }
    }
}
