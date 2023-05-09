import type { Renderable } from '../../renderers/shared/Renderable';
import type { Bounds } from './Bounds';

export function getGlobalRenderableBounds(renderables: Renderable[], bounds: Bounds): Bounds
{
    bounds.clear();

    // instead of copying the matrix each time we are assigning it in bounds
    // this is a performance hack :D
    // so we need to restore the matrix after we are done

    const tempMatrix = bounds.matrix;

    for (let i = 0; i < renderables.length; i++)
    {
        const renderable = renderables[i];

        if (!renderable.visible)
        {
            continue;
        }

        bounds.matrix = renderable.data.worldTransform;
        renderable.addBounds(bounds);
    }

    bounds.matrix = tempMatrix;

    return bounds;
}
