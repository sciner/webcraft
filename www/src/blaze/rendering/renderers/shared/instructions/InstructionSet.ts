import type { Renderer } from '../../types.js';
import type { Renderable } from '../Renderable.js';
import type { Instruction } from './Instruction.js';

let uid = 0;

export class InstructionSet
{
    renderableToUpdate: Renderable[] = [];

    visible = true;

    renderer: Renderer;
    rebuild = false;

    bundled = false;

    instructions: Instruction[] = [];
    instructionSize = 0;

    buildTick = 0;
    updateCount = 0;
    id = uid++;

    reset()
    {
        this.instructionSize = 0;
        this.bundled = false;
        this.buildTick++;
    }

    /**
     * flags a renderable for updating
     * it can be called multiple times only storing one copy of the renderable in the update list
     * @param renderable - the renderable to update
     */
    updateRenderable(renderable: Renderable)
    {
        if (renderable.renderableUpdateRequested) return;

        renderable.renderableUpdateRequested = true;

        this.renderableToUpdate[this.updateCount++] = renderable;
    }

    addInstruction(instruction: Instruction)
    {
        this.instructions[this.instructionSize++] = instruction;
    }

    lastInstruction(): Instruction
    {
        return this.instructions[this.instructionSize - 1];
    }

    log()
    {
        this.instructions.length = this.instructionSize;
        // eslint-disable-next-line no-console
        console.log(this.instructions);
        // eslint-disable-next-line no-console
        console.table(this.instructions, ['type', 'action']);
    }
}
