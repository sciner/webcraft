import type { WebGPURenderer } from '../../gpu/WebGPURenderer';
import type { Instruction } from './Instruction';
import type { InstructionSet } from './InstructionSet';
import type { InstructionGenerator, InstructionRunner } from './RenderPipe';

export interface BundleInstruction extends Instruction
{
    type: 'bundles';
    bundle: GPURenderBundle;
}

export class BundlePipe implements InstructionRunner<BundleInstruction>, InstructionGenerator
{
    instructionSet: InstructionSet;

    instructionStack: InstructionSet[] = [];
    renderer: WebGPURenderer;

    constructor(renderer: WebGPURenderer)
    {
        this.renderer = renderer;
    }

    bind(instructionSet: InstructionSet)
    {
        this.instructionSet = instructionSet;
    }

    addBundle(bundle: GPURenderBundleEncoder)
    {
        this.instructionSet.instructions[this.instructionSet.instructionSize++] = {
            type: 'bundles',
            bundle,
        };
    }

    execute(instruction: BundleInstruction)
    {
        const renderer = this.renderer;

        renderer.renderPipes.renderPassEncoder.activePassEncoder.gpuPassEncoder.executeBundles([instruction.bundle]);
    }
}
