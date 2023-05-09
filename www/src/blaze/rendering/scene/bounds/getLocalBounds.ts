import { Matrix } from '../../../maths/Matrix';

import type { Container } from '../Container';
import type { Bounds } from './Bounds';

export function getLocalBounds(target: Container, matrix: Matrix, bounds: Bounds): Bounds
{
    bounds.clear();

    bounds.pushMatrix(matrix || new Matrix());

    if (target.renderable)
    {
        target.renderable.addBounds(bounds);
    }

    for (let i = 0; i < target.children.length; i++)
    {
        _getLocalBounds(target.children[i], bounds, target);
    }

    return bounds;
}

export function _getLocalBounds(target: Container, bounds: Bounds, localRoot: Container): void
{
    if (!target.measurable) return;

    // make sure localTransform is upto date...
    target.updateLocalTransform();

    bounds.pushMatrix(target.localTransform);

    if (target.renderable)
    {
        target.renderable.addBounds(bounds);
    }

    for (let i = 0; i < target.children.length; i++)
    {
        _getLocalBounds(target.children[i], bounds, localRoot);
    }

    for (let i = 0; i < target.effects.length; i++)
    {
        target.effects[i].addLocalBounds?.(bounds, localRoot);
    }
    // }

    bounds.popMatrix();
}

export function getParent(target: Container, root: Container, matrix: Matrix)
{
    const parent = target.parent;

    if (!parent)
    {
        // we have reach the top of the tree!
        console.warn('Item is not inside the root container');

        return;
    }

    if (parent !== root)
    {
        getParent(parent, root, matrix);

        parent.updateLocalTransform();
        matrix.append(parent.localTransform);
    }
}

export function getMatrixRelativeToParent(target: Container, root: Container, matrix: Matrix)
{
    if (!target)
    {
        // we have reach the top of the tree!
        console.warn('Item is not inside the root container');

        return;
    }

    if (target !== root)
    {
        getMatrixRelativeToParent(target.parent, root, matrix);

        target.updateLocalTransform();
        matrix.append(target.localTransform);
    }
}
