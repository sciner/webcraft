import { ExtensionType } from '../../../extensions/Extensions.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { MaskFilter } from '../../filters/mask/MaskFilter.js';
import type { Instruction } from '../../renderers/shared/instructions/Instruction.js';
import type { InstructionSet } from '../../renderers/shared/instructions/InstructionSet.js';
import type { InstructionGenerator, InstructionRunner } from '../../renderers/shared/instructions/RenderPipe.js';
import type { RenderTarget } from '../../renderers/shared/renderTarget/RenderTarget.js';
import type { Texture } from '../../renderers/shared/texture/Texture.js';
import type { Renderer } from '../../renderers/types.js';
import type { Container } from '../../scene/Container.js';
import type { ColorMask } from './ColorMask.js';
import type { StencilMask } from './StencilMask.js';

export interface ColorMaskInstruction extends Instruction
{
    type: 'colorMask',
    colorMask: number,
}

export interface ColorMaskData
{
    previousRenderTarget: RenderTarget,
    filter: [MaskFilter],
    container: Container,
    filterTexture: Texture,
}

export class ColorMaskPipe implements InstructionRunner<ColorMaskInstruction>, InstructionGenerator
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererPipes,
            ExtensionType.WebGPURendererPipes,
            ExtensionType.CanvasRendererPipes,
        ],
        name: 'colorMask',
    };

    instructionSet: InstructionSet;
    renderer: Renderer;
    filterPool: MaskFilter[] = [];

    colorStack: number[] = [];
    colorStackIndex = 0;
    currentColor = 0;

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

    buildStart()
    {
        this.colorStack[0] = 0xF;
        this.colorStackIndex = 1;
        this.currentColor = 0xF;
    }

    push(mask: ColorMask): void
    {
        const { renderer, instructionSet } = this;

        renderer.renderPipes.batch.break();

        const colorStack = this.colorStack;

        colorStack[this.colorStackIndex] = colorStack[this.colorStackIndex - 1] & mask.mask;

        const currentColor = this.colorStack[this.colorStackIndex];

        if (currentColor !== this.currentColor)
        {
            this.currentColor = currentColor;
            instructionSet.addInstruction({
                type: 'colorMask',
                colorMask: currentColor,
                canBundle: false,
            } as ColorMaskInstruction);
        }

        this.colorStackIndex++;
    }

    pop(_mask: ColorMask): void
    {
        const { renderer, instructionSet } = this;

        renderer.renderPipes.batch.break();

        const colorStack = this.colorStack;

        this.colorStackIndex--;

        const currentColor = colorStack[this.colorStackIndex - 1];

        if (currentColor !== this.currentColor)
        {
            this.currentColor = currentColor;

            instructionSet.addInstruction({
                type: 'colorMask',
                colorMask: currentColor,
                canBundle: false,
            } as ColorMaskInstruction);
        }
    }

    execute(instruction: ColorMaskInstruction)
    {
        const renderer = this.renderer;

        renderer.colorMask.setMask(instruction.colorMask);
    }
}
