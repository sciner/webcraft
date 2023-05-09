import type { BatchableObject } from '../../../batcher/shared/Batcher';
import type { Renderable } from '../Renderable';
import type { Instruction } from './Instruction';
import type { InstructionSet } from './InstructionSet';

export interface InstructionRunner<INSTRUCTION extends Instruction>
{
    bind: (instructionSet: InstructionSet) => void;
    upload?: (instructionSet: InstructionSet) => void;
    execute?: (instruction: INSTRUCTION) => void;
}

export interface InstructionGenerator
{
    bind: (instructionSet: InstructionSet) => void;
    buildReset?: () => void;
    buildStart?: () => void;
    buildEnd?: () => void;
}

export interface RenderablePipe<RENDERABLE extends Renderable>
{
    addRenderable: (renderable: RENDERABLE) => void;
    updateRenderable: (renderable: RENDERABLE) => void;
    updateVisibility: (renderable: RENDERABLE) => void;
}

export interface BatchPipe
{
    addToBatch: (renderable: BatchableObject, visible: boolean) => void;
    break: () => void;
}

