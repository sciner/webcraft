import { ExtensionType } from '../../../extensions/Extensions.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { InstructionSet } from '../shared/instructions/InstructionSet.js';
import type { ISystem } from '../shared/system/ISystem.js';
import type { WebGPURenderer } from './WebGPURenderer.js';

const BUNDLE = true;
/**
 * The view system manages the main canvas that is attached to the DOM.
 * This main role is to deal with how the holding the view reference and dealing with how it is resized.
 * @memberof PIXI
 */

export class GpuBundleSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGPURendererSystem,
        ],
        name: 'bundle',
    };
    _renderer: WebGPURenderer;
    instructionSet: InstructionSet;
    _renderPipes: any;

    constructor(renderer: WebGPURenderer)
    {
        this._renderer = renderer;
        this._renderPipes = renderer.renderPipes;
    }

    bundle(instructionSet: InstructionSet): void
    {
        if (BUNDLE && !instructionSet.bundled)
        {
            instructionSet.bundled = true;

            const newInstructions = this.record(instructionSet);

            instructionSet.instructions = newInstructions;
            instructionSet.instructionSize = newInstructions.length;
        }
    }

    record(instructionSet: InstructionSet)
    {
        const instructions = instructionSet.instructions;
        const renderPipes = this._renderPipes;
        const renderer = this._renderer;

        renderer.instructions.bind(instructionSet);

        const newInstructions = [];

        let activeEncoder = false;

        for (let i = 0; i < instructionSet.instructionSize; i++)
        {
            const instruction = instructions[i];

            if (instruction.canBundle)
            {
                if (!activeEncoder)
                {
                    activeEncoder = true;
                    renderPipes.renderPassEncoder.activePassEncoder.startRecording();
                }

                renderPipes[instruction.type].execute(instruction, renderer);
            }
            else
            {
                if (activeEncoder)
                {
                    activeEncoder = false;
                    const bundle = renderPipes.renderPassEncoder.activePassEncoder.stopRecording();
                    // wrap uo bundle..

                    newInstructions.push({
                        type: 'bundles',
                        bundle,
                    });
                }

                newInstructions.push(instruction);

                if (instruction.type === 'globalUniforms')
                {
                    renderPipes.globalUniforms.execute(instruction);
                }
            }
        }

        if (activeEncoder)
        {
            const bundle = renderPipes.renderPassEncoder.activePassEncoder.stopRecording();

            newInstructions.push({
                type: 'bundles',
                bundle,
            });
        }

        return newInstructions;
    }

    destroy()
    {
        // todo
    }
}
