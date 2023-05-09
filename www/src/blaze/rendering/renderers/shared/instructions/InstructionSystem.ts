import { ExtensionType } from '../../../../extensions/Extensions';
import { Runner } from '../runner/Runner';

import type { ExtensionMetadata } from '../../../../extensions/Extensions';
import type { Renderer } from '../../types';
import type { Renderable } from '../Renderable';
import type { ISystem } from '../system/ISystem';
import type { InstructionSet } from './InstructionSet';

/**
 * The view system manages the main canvas that is attached to the DOM.
 * This main role is to deal with how the holding the view reference and dealing with how it is resized.
 * @memberof PIXI
 */
export class InstructionSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererSystem,
            ExtensionType.WebGPURendererSystem,
            ExtensionType.CanvasRendererSystem,
        ],
        name: 'instructions',
    };

    _renderer: Renderer;
    instructionSet: InstructionSet;
    _renderPipes: any;

    _validateRenderable: Renderable[] = [];
    _validateRenderableIndex = 0;

    runners = {
        // called once when a runner is kciked off
        init: new Runner('init'),

        bind: new Runner('bind'),
        validateInstructions: new Runner('validateInstructions'),

        buildReset: new Runner('buildReset'),
        buildStart: new Runner('buildStart'),
        buildEnd: new Runner('buildEnd'),

        upload: new Runner('upload'),

        renderStart: new Runner('renderStart'),
        renderEnd: new Runner('renderEnd'),
    };

    constructor(renderer: Renderer)
    {
        this._renderer = renderer;
        this._renderPipes = renderer.renderPipes;

        let i: keyof typeof renderer.renderPipes;

        for (i in renderer.renderPipes)
        {
            let j: keyof typeof this.runners;

            for (j in this.runners)
            {
                this.runners[j].add(renderer.renderPipes[i]);
            }
        }

        // this.runners.init.emit();
    }

    init()
    {
        this.runners.init.emit();
    }

    bind(instructionSet: InstructionSet): void
    {
        if (this.instructionSet === instructionSet) return;

        this.instructionSet = instructionSet;

        this.runners.bind.emit(instructionSet);
    }

    validateInstructions()
    {
        // check if instructions are valid!
        this.runners.validateInstructions.emit();

        let rebuildRequired = false;

        // check if renderables are valid!
        for (let i = 0; i < this._validateRenderableIndex; i++)
        {
            const renderable = this._validateRenderable[i];

            const _rebuildRequired = this._renderPipes[renderable.type].validateRenderable(renderable);

            rebuildRequired = rebuildRequired || _rebuildRequired;

            if (!rebuildRequired)
            {
                renderable.instructionSet.updateRenderable(renderable);
            }
        }

        if (rebuildRequired)
        {
            this.instructionSet.rebuild = true;
        }

        this._validateRenderableIndex = 0;
    }

    // first we have a build phase.. this generates a set of instructions for the renderer
    // the build is only triggered by changes to the scene graph or texture batches
    buildStart(): void
    {
        this.instructionSet.reset();

        this.runners.buildReset.emit();

        this.runners.buildStart.emit();
    }

    buildAdd(renderable: Renderable)
    {
        renderable.buildId = this.instructionSet.buildTick;

        if (!renderable.instructionSet)
        {
            // TODO look into what happens when an instruction set is changed...
            renderable.instructionSet = this.instructionSet;

            renderable.onRenderableUpdate = () =>
            {
                if (renderable.buildId !== renderable.instructionSet.buildTick) return;

                this._validateRenderable[this._validateRenderableIndex++] = renderable;
            };
        }

        this._renderPipes[renderable.type].addRenderable(renderable);
    }

    buildFinish()
    {
        const renderPipes = this._renderPipes;

        renderPipes.batch.break();

        this.runners.buildEnd.emit();
    }

    //

    updateAndUpload()
    {
        const instructionSet = this.instructionSet;

        const toUpdate = instructionSet.renderableToUpdate;
        const count = instructionSet.updateCount;
        const pipes = this._renderPipes;

        for (let i = 0; i < count; i++)
        {
            const renderable = toUpdate[i];

            if (renderable.renderableUpdateRequested)
            {
                renderable.renderableUpdateRequested = false;

                if (renderable.visible)
                {
                    pipes[renderable.type].updateRenderable(renderable);
                }
            }
        }

        instructionSet.updateCount = 0;

        this.runners.upload.emit();
    }

    /**
     * this is used as a to update a renderable straight away
     * used when the scene graph changes to save looping through the entities twice
     * @param renderable - the renderable to update
     */
    updateRenderableNow(renderable: Renderable)
    {
        renderable.renderableUpdateRequested = false;
        this._renderPipes[renderable.type].updateRenderable(renderable);
    }

    updateVisibility(renderable: Renderable)
    {
        this._renderPipes[renderable.type].updateVisibility(renderable);
    }

    execute(root: boolean)
    {
        const instructionSet = this.instructionSet;
        const instructions = instructionSet.instructions;
        const renderPipes = this._renderPipes;

        if (root)
        {
            this.runners.renderStart.emit();
        }

        for (let i = 0; i < instructionSet.instructionSize; i++)
        {
            const instruction = instructions[i];

            renderPipes[instruction.type].execute(instruction);
        }

        if (root)
        {
            this.runners.renderEnd.emit();
        }
    }

    destroy()
    {
        // todo
    }
}
