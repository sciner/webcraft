import { ExtensionType } from '../../../../extensions/Extensions';

import type { ExtensionMetadata } from '../../../../extensions/Extensions';
import type { Renderer } from '../../types';
import type { Instruction } from './Instruction';
import type { InstructionSet } from './InstructionSet';
import type { InstructionGenerator, InstructionRunner } from './RenderPipe';

export interface GroupInstruction extends Instruction
{
    type: 'instruction';
    visible: boolean;
    instructionSet: InstructionSet;
}

export class InstructionPipe implements InstructionRunner<GroupInstruction>, InstructionGenerator
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererPipes,
            ExtensionType.WebGPURendererPipes,
            ExtensionType.CanvasRendererPipes,
        ],
        name: 'instruction',
    };

    instructionSet: InstructionSet;

    instructionStack: InstructionSet[] = [];
    renderer: Renderer;

    constructor(renderer: Renderer)
    {
        this.renderer = renderer;
    }

    bind(instructionSet: InstructionSet)
    {
        this.instructionSet = instructionSet;
    }

    addRenderGroup(data: {instructionSet: InstructionSet, visible: boolean})
    {
        this.instructionSet.instructions[this.instructionSet.instructionSize++] = data;
    }

    execute(instruction: GroupInstruction)
    {
        const renderer = this.renderer;

        const currentInstructionSet = renderer.instructions.instructionSet;

        const instructionSet = instruction.instructionSet;

        // TODO fix this visible disabled hack
        // if (instruction.visible)
        // {
        // TODO bind the other render group!
        renderer.instructions.bind(instructionSet);

        renderer.instructions.execute(false);

        renderer.instructions.bind(currentInstructionSet);
        // }
    }
}
