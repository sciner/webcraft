import { ExtensionType } from '../../extensions/Extensions';
import { BLEND_MODES } from '../renderers/shared/state/const';
import { Container, UPDATE_BLEND, UPDATE_COLOR, UPDATE_VISIBLE } from './Container';
import { mixHexColors } from './mixHexColors';
import { updateLocalTransform } from './utils/updateLocalTransform';
import { updateWorldTransform } from './utils/updateWorldTransform';

import type { ExtensionMetadata } from '../../extensions/Extensions';
import type { InstructionSystem } from '../renderers/shared/instructions/InstructionSystem';
import type { Renderable } from '../renderers/shared/Renderable';
import type { ISystem } from '../renderers/shared/system/ISystem';
import type { RenderGroup } from './RenderGroup';

const tempContainer = new Container();

tempContainer.blendMode = BLEND_MODES.NORMAL;
tempContainer.worldVisibleRenderable = 0b11;

const WHITE_WHITE = 0xFFFFFF + (0xFFFFFF << 32);

interface TransformRenderer
{
    instructions: InstructionSystem;

}

/**
 * The view system manages the main canvas that is attached to the DOM.
 * This main role is to deal with how the holding the view reference and dealing with how it is resized.
 * @memberof PIXI
 */
export class TransformSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererSystem,
            ExtensionType.WebGPURendererSystem,
            ExtensionType.CanvasRendererSystem,
        ],
        name: 'transform',
    };

    renderer: TransformRenderer;

    updateDuringTransform = false;

    constructor(renderer: TransformRenderer)
    {
        this.renderer = renderer;
    }

    update(renderGroup: RenderGroup)
    {
        const toUpdate = renderGroup._toUpdate;
        const tick = renderGroup._tick;
        const root = renderGroup.root;

        const instructionSystem = this.renderer.instructions;

        root.parent = tempContainer;

        this.updateDuringTransform = (!renderGroup._structureChange && !renderGroup.instructionSet.rebuild);

        renderGroup._tick++;

        root.worldVisibleRenderable = root._localVisibleRenderable;

        for (const j in toUpdate)
        {
            const itemsAtDepth = toUpdate[j];

            const list = itemsAtDepth.list;
            const index = itemsAtDepth.index;

            for (let i = 0; i < index; i++)
            {
                const displayObject = list[i];

                displayObject.isUpdatedThisFrame = 0;

                // may have been removed!
                if (displayObject.parentRenderGroup === renderGroup)
                {
                    this.updateTransformAndChildren(
                        displayObject,
                        displayObject.colorBlendVisibleUpdate,
                        instructionSystem,
                        tick
                    );

                    displayObject.colorBlendVisibleUpdate = 0;
                }
            }

            itemsAtDepth.index = 0;
        }
    }

    /**
     * Updates the local and the world transformation matrices.
     * @param container
     * @param toUpdate
     * @param instructionSystem
     */
    updateTransform(container: Container, toUpdate: number, instructionSystem: InstructionSystem): void
    {
        const parent = container.parentTransform;

        if (toUpdate)
        {
            this.updateColorBlendVisibility(container, parent, toUpdate, instructionSystem);
        }

        if (!(container.worldVisibleRenderable & 0b10)) return;

        this.updateVisible(container, parent, container.renderable, instructionSystem);
    }

    updateVisible(container: Container, parent: Container, renderable: Renderable, instructionSystem: InstructionSystem)
    {
        const lt = container.localTransform;
        const pt = parent.worldTransform;
        const wt = container.worldTransform;

        if (container._localTransformID !== container._currentLocalTransformID)
        {
            updateLocalTransform(lt, container);

            // force an update..
            updateWorldTransform(lt, pt, wt);

            container._currentLocalTransformID = container._localTransformID;

            container._parentWorldTransformID = parent._worldTransformID;

            // update the id of the transform..
            container._worldTransformID++;
        }
        else if (container._parentWorldTransformID !== parent._worldTransformID)
        {
            updateWorldTransform(lt, pt, wt);

            container._parentWorldTransformID = parent._worldTransformID;

            // update the id of the transform..
            container._worldTransformID++;
        }

        /**
         * cheeky update that happens during the updateTransform loop
         * rather than waiting for iterating a second loop after the transforms
         * only works if the wa no rebuild.
         */
        if (renderable && (container.worldVisibleRenderable === 0b11) && this.updateDuringTransform)
        {
            instructionSystem.updateRenderableNow(renderable);
        }
    }

    updateVisibility(renderable: Renderable, visible: boolean, instructionSystem: InstructionSystem)
    {
        if (renderable)
        {
            renderable.visible = visible;

            // TODO don't store this here...

            if (this.updateDuringTransform)
            {
                instructionSystem.updateVisibility(renderable);
            }
        }
    }

    private updateTransformAndChildren(
        container: Container,
        toUpdate: number,
        instructionSystem: InstructionSystem,
        tick: number
    ): void
    {
        if (tick === container.rTick) return;
        container.rTick = tick;

        toUpdate = toUpdate | container.colorBlendVisibleUpdate;

        this.updateTransform(container, toUpdate, instructionSystem);

        const children = container.children;
        const length = children.length * container.layer;

        for (let i = 0; i < length; i++)
        {
            this.updateTransformAndChildren(children[i], toUpdate, instructionSystem, tick);
        }
    }

    private updateColorBlendVisibility(
        container: Container,
        parent: Container,
        toUpdate: number,
        instructionSystem: InstructionSystem
    ): void
    {
        if (toUpdate & UPDATE_COLOR)
        {
            container.worldAlpha = container._localAlpha * parent.worldAlpha;

            if (parent.worldTint + (container._localTint << 32) !== WHITE_WHITE)
            {
                this.updateContainerTintColor(container, parent);
            }

            container.worldTintAlpha = container.worldTint + ((container.worldAlpha * 255) << 24);
        }

        if (toUpdate & UPDATE_BLEND)
        {
            container.worldBlendMode = container._localBlendMode || parent.worldBlendMode;
        }

        if (toUpdate & UPDATE_VISIBLE)
        {
            const newWorldVisible = container._localVisibleRenderable & parent.worldVisibleRenderable;

            if (container.worldVisibleRenderable !== newWorldVisible)
            {
                container.worldVisibleRenderable = newWorldVisible;
                this.updateVisibility(container.renderable, newWorldVisible === 0b11, instructionSystem);
            }
        }
    }

    private updateContainerTintColor(container: Container, parent: Container): void
    {
        if (parent.worldTint === 0xFFFFFF)
        {
            container.worldTint = container._localTint;
        }
        else if (container._localTint === 0xFFFFFF)
        {
            container.worldTint = parent.worldTint;
        }
        else
        {
            container.worldTint = mixHexColors(container._localTint, parent.worldTint, 0.5);
        }
    }

    destroy()
    {
        // boom!
    }
}
