import { ExtensionType } from '../../extensions/Extensions.js';

import type { ExtensionMetadata } from '../../extensions/Extensions.js';
import type { InstructionSystem } from '../renderers/shared/instructions/InstructionSystem.js';
import type { ISystem } from '../renderers/shared/system/ISystem.js';
import type { BuilderSystem } from './BuilderSystem.js';
import type { Container } from './Container.js';
import type { RenderGroup } from './RenderGroup.js';
import type { TransformSystem } from './TransformSystem.js';

interface ContainerRenderer
{
    instructions: InstructionSystem;
    builder: BuilderSystem;
    transform: TransformSystem;
}

/**
 * The view system manages the main canvas that is attached to the DOM.
 * This main role is to deal with how the holding the view reference and dealing with how it is resized.
 * @memberof PIXI
 */

export class ContainerSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererSystem,
            ExtensionType.WebGPURendererSystem,
            ExtensionType.CanvasRendererSystem,
        ],
        name: 'container',
    };

    renderer: ContainerRenderer;

    constructor(renderer: ContainerRenderer)
    {
        this.renderer = renderer;
    }

    render(container: Container): void
    {
        container.attachRenderGroup();

        const renderGroup = container.renderGroup;

        const renderer = this.renderer;

        this.updateChildRenderGroups(renderGroup);

        // must ALWAYS to update transform FIRST.
        // if we know a build is coming, we can ignore the updating of the renderables

        this.updateRenderGroup(renderGroup);

        // set a default global uniforms
        //  renderGroup.instructionSet.log();
        // set default encoder..
        renderer.instructions.bind(renderGroup.instructionSet);
        renderer.instructions.execute(true);
    }

    updateChildRenderGroups(renderGroup: RenderGroup)
    {
        const renderGroups = renderGroup.childRenderGroups;

        for (let i = 0; i < renderGroups.length; i++)
        {
            this.updateRenderGroup(renderGroups[i]);
        }
    }

    updateRenderGroup(renderGroup: RenderGroup)
    {
        const renderer = this.renderer;

        renderGroup.runOnRender();

        renderer.instructions.bind(renderGroup.instructionSet);

        // check if any batches got broken...
        renderer.instructions.validateInstructions();

        renderer.transform.update(renderGroup);

        renderer.builder.checkAndRebuild(renderGroup);
        renderer.instructions.updateAndUpload();
    }

    destroy()
    {
        // boom!
    }
}
