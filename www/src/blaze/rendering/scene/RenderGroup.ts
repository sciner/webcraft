import { InstructionSet } from '../renderers/shared/instructions/InstructionSet';
import { Container } from './Container';

import type { Instruction } from '../renderers/shared/instructions/Instruction';

// don't laugh - this is a silly optimisation that saves a few 'this' calls...

// TODO - maybe change this?

export class RenderGroup implements Instruction
{
    type = 'instruction';
    canBundle = false;

    root: Container;

    _tick = 0;

    readonly _toUpdate: Record<number, {list: Container[], index: number}> = {};

    _structureChange = false;

    childRenderGroups: RenderGroup[] = [];

    instructionSet: InstructionSet;

    updateTick = 0;

    onRenderContainers: Container[] = [];

    constructor(root: Container)
    {
        this.root = root;

        this.instructionSet = new InstructionSet();

        root.renderGroup = this;

        const children = root.children;

        for (let i = 0; i < children.length; i++)
        {
            children[i].parentTransform = Container.IDENTITY;
            this.addChild(children[i]);
        }
    }

    addChild(child: Container)
    {
        this._structureChange = true;

        child.parentRenderGroup = this;
        child.sceneDepth = child.parent.sceneDepth + 1;
        child.isUpdatedThisFrame = 0;

        if (child._onRender)
        {
            this.addOnRender(child);
        }

        if (child.renderGroup)
        {
            this.addRenderGroup(child.renderGroup);
            child.onChange();

            return;
        }

        const children = child.children;

        for (let i = 0; i < children.length; i++)
        {
            this.addChild(children[i]);
        }

        child.onChange();
    }

    removeChild(child: Container)
    {
        if (child._onRender)
        {
            this.removeOnRender(child);
        }

        child.parentRenderGroup = null;

        this._structureChange = true;

        const children = child.children;

        for (let i = 0; i < children.length; i++)
        {
            this.removeChild(children[i]);
        }
    }

    addRenderGroup(renderGroup: RenderGroup)
    {
        // need to remove the updates and its children..
        this._structureChange = true;
        this.childRenderGroups.push(renderGroup);
    }

    removeRenderGroup(renderGroup: RenderGroup)
    {
        // need to remove the updates and its children..

        this.childRenderGroups.splice(this.childRenderGroups.indexOf(renderGroup), 1);

        this.addChild(renderGroup.root);
    }

    public onChange(container: Container): void
    {
        let toUpdate = this._toUpdate[container.sceneDepth];

        if (!toUpdate)
        {
            toUpdate = this._toUpdate[container.sceneDepth] = {
                index: 0,
                list: [],
            };
        }

        toUpdate.list[toUpdate.index++] = container;
    }

    /**
     * adding a container to the onRender list will make sure the user function
     * passed in to the user defined 'onRender` callBack
     * @param container - the container to add to the onRender list
     */
    addOnRender(container: Container)
    {
        this.onRenderContainers.push(container);
    }

    removeOnRender(container: Container)
    {
        this.onRenderContainers.splice(this.onRenderContainers.indexOf(container), 1);
    }

    runOnRender()
    {
        this.onRenderContainers.forEach((container) =>
        {
            container._onRender();
        });
    }
    /** called by container directly when something complex happens - filter change - mask change - render group change */
    public onStructureChange()
    {
        // TODO we can optimise this further down the way!
        this._structureChange = true;
    }
}
