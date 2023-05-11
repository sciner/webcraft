import { ExtensionType } from '../../../extensions/Extensions.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { Matrix } from '../../../maths/Matrix.js';
import type { Instruction } from '../shared/instructions/Instruction.js';
import type { InstructionSet } from '../shared/instructions/InstructionSet.js';
import type { InstructionGenerator, InstructionRunner } from '../shared/instructions/RenderPipe.js';
import type { GlobalUniformGroup } from '../shared/renderTarget/GlobalUniformSystem.js';
import type { Renderer } from '../types.js';

export interface GlobalUniformInstruction extends Instruction
{
    type: 'globalUniforms';

    projection: Matrix
    globalUniforms: GlobalUniformGroup
    transformAndAlpha: TransformAndAlpha
}

export interface TransformAndAlpha
{
    worldTransform: Matrix;
    worldAlpha: number;
}

// TODO optimize the use of array push pop with our index system

export class GpuGlobalUniformPipe implements InstructionRunner<GlobalUniformInstruction>, InstructionGenerator
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGPURendererPipes,
        ],
        name: 'globalUniforms',
    };
    instructionSet: InstructionSet;

    renderer: Renderer;

    constructor(renderer: Renderer)
    {
        this.renderer = renderer;
    }

    bind(instructionSet: InstructionSet)
    {
        this.instructionSet = instructionSet;
    }

    pushGlobalUniforms(projection: Matrix, transformAndAlpha: TransformAndAlpha)
    {
        this.instructionSet.addInstruction({
            type: 'globalUniforms',
            action: 'push',
            projection,
            transformAndAlpha,
            canBundle: false,
        } as GlobalUniformInstruction);
    }

    popGlobalUniforms()
    {
        this.instructionSet.addInstruction({
            type: 'globalUniforms',
            action: 'pop',
            canBundle: false,
        });
    }

    execute(instruction: GlobalUniformInstruction)
    {
        if (instruction.action === 'push')
        {
            this.renderer.globalUniforms.push(
                instruction.projection,
                instruction.transformAndAlpha.worldTransform,
                instruction.transformAndAlpha.worldAlpha,
            );
        }
        else if (instruction.action === 'pop')
        {
            this.renderer.globalUniforms.pop();
        }
    }

    renderStart()
    {
        this.renderer.globalUniforms.reset(
            this.renderer.renderTarget.rootProjectionMatrix
        );
    }
}

