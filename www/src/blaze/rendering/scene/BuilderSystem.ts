import { ExtensionType } from '../../extensions/Extensions.js';

import type { ExtensionMetadata } from '../../extensions/Extensions.js';
import type { GpuGlobalUniformPipe } from '../renderers/gpu/GpuGlobalUniformPipe.js';
import type { InstructionSet } from '../renderers/shared/instructions/InstructionSet.js';
import type { InstructionSystem } from '../renderers/shared/instructions/InstructionSystem.js';
import type { ISystem } from '../renderers/shared/system/ISystem.js';
import type { Container } from './Container.js';
import type { RenderGroup } from './RenderGroup.js';

interface BuilderRenderer
{
    instructions: InstructionSystem;
    renderPipes: any;
}

/**
 * The view system manages the main canvas that is attached to the DOM.
 * This main role is to deal with how the holding the view reference and dealing with how it is resized.
 * @memberof PIXI
 */

export class BuilderSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererSystem,
            ExtensionType.WebGPURendererSystem,
            ExtensionType.CanvasRendererSystem,
        ],
        name: 'builder',
    };

    renderer: BuilderRenderer;
    container: Container;

    // builder: Builder;

    constructor(renderer: BuilderRenderer)
    {
        this.renderer = renderer;
        this.container = null;
    }

    public checkAndRebuild(renderGroup: RenderGroup)
    {
        const renderer = this.renderer;

        const instructionSet = renderGroup.instructionSet;

        const rebuildRequired = (renderGroup._structureChange || renderGroup.instructionSet.rebuild);

        if (rebuildRequired)
        {
            renderer.instructions.buildStart();

            instructionSet.rebuild = false;

            const children = renderGroup.root.children;

            if (children.length)
            {
                for (let i = 0; i < children.length; i++)
                {
                    this.collectAllRenderables(children[i], instructionSet, renderGroup.updateTick, renderer);// , list);
                }
            }

            renderer.instructions.buildFinish();
            // renderGroup.instructionSet.log();
        }

        renderGroup._structureChange = false;
    }

    public collectAllRenderables(
        container: Container,
        instructionSet: InstructionSet,
        updateTick: number,
        renderer: BuilderRenderer
    ): void
    {
        if (!container.includeInBuild) return;

        if (container.isSimple)
        {
            this._collectAllRenderablesSimple(container, instructionSet, updateTick, renderer);
        }
        else
        {
            this._collectAllRenderablesAdvanced(container, instructionSet, updateTick, renderer);
        }
    }

    private _collectAllRenderablesSimple(
        container: Container,
        instructionSet: InstructionSet,
        updateTick: number,
        renderer: BuilderRenderer
    ): void
    {
        const renderable = container.renderable;

        if (renderable)
        {
            renderer.renderPipes.blendMode.setBlendMode(renderable, container.worldBlendMode);

            renderer.instructions.buildAdd(renderable);
            renderable.updateTick = updateTick;
        }

        const children = container.children;

        if (children.length * container.layer)
        {
            for (let i = 0; i < children.length; i++)
            {
                this.collectAllRenderables(children[i], instructionSet, updateTick, renderer);// , list);
            }
        }
    }

    private _collectAllRenderablesAdvanced(
        container: Container,
        instructionSet: InstructionSet,
        updateTick: number,
        renderer: BuilderRenderer
    ): void
    {
        const renderPipes = renderer.renderPipes;

        for (let i = 0; i < container.effects.length; i++)
        {
            const effect = container.effects[i];

            renderPipes[effect.pipe].push(effect, container);
        }

        if (container.renderGroup)
        {
            const globalUniforms: GpuGlobalUniformPipe = renderPipes.globalUniforms;

            renderPipes.batch.break();

            renderPipes.globalUniforms.pushGlobalUniforms(
                renderPipes.renderTarget.projectionMatrix,
                container
            );

            renderPipes.instruction.addRenderGroup(container.renderGroup);

            globalUniforms.popGlobalUniforms();
        }
        else
        {
            const renderable = container.renderable;

            if (renderable)
            {
                renderPipes.blendMode.setBlendMode(renderable, container.worldBlendMode);

                renderer.instructions.buildAdd(renderable);
                renderable.updateTick = updateTick;
            }

            const children = container.children;

            if (children.length)
            {
                for (let i = 0; i < children.length; i++)
                {
                    this.collectAllRenderables(children[i], instructionSet, updateTick, renderer);// , list);
                }
            }
        }

        // loop backwards through effects
        for (let i = container.effects.length - 1; i >= 0; i--)
        {
            const effect = container.effects[i];

            renderPipes[effect.pipe].pop(effect, container);
        }
    }

    destroy()
    {
        // kaboom
    }
}
