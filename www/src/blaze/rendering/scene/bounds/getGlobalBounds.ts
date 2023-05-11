import type { Container } from '../Container.js';
import type { Bounds } from './Bounds.js';

export function getGlobalBounds(target: Container, skipUpdateTransform: boolean, bounds: Bounds): Bounds
{
    bounds.clear();

    // need to make sure parents are updated..
    if (!skipUpdateTransform)
    {
        updateParents(target);

        // update the transforms...
        target.updateLocalTransform();
        target.updateWorldTransform();
    }

    // then collect them...
    _getGlobalBounds(target, skipUpdateTransform, bounds);

    return bounds;
}

export function _getGlobalBounds(target: Container, skipUpdateTransform: boolean, bounds: Bounds): void
{
    if (!target.measurable) return;

    if (!skipUpdateTransform)
    {
        target.updateLocalTransform();
        target.updateWorldTransform();
    }

    if (target.renderable)
    {
        bounds.setMatrix(target.worldTransform);
        target.renderable.addBounds(bounds);
    }

    for (let i = 0; i < target.children.length; i++)
    {
        _getGlobalBounds(target.children[i], skipUpdateTransform, bounds);
    }

    for (let i = 0; i < target.effects.length; i++)
    {
        target.effects[i].addBounds?.(bounds);
    }

    if (target.renderGroup)
    {
        bounds.applyMatrix(target.worldTransform);
    }
}

export function updateParents(target: Container)
{
    const parent = target.parent;

    if (parent)
    {
        updateParents(parent);

        parent.updateLocalTransform();
        parent.updateWorldTransform();
    }
}

