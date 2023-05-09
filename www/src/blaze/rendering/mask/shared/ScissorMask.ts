import { addMaskBounds, addMaskLocalBounds } from './addMaskBounds';

import type { PointData } from '../../../maths/PointData';
import type { Bounds } from '../../scene/bounds/Bounds';
import type { Container } from '../../scene/Container';
import type { Effect } from '../../scene/Effect';

export class ScissorMask implements Effect
{
    priority = 0;
    mask: Container;
    pipe = 'scissorMask';
    renderMask: boolean;

    constructor(mask: Container)
    {
        this.mask = mask;

        this.mask.isRenderable = false;
        this.mask.measurable = false;

        this.renderMask = false;// !(mask instanceof Sprite && !mask.children.length);
    }

    addBounds(bounds: Bounds): void
    {
        addMaskBounds(this.mask, bounds);
    }

    addLocalBounds(bounds: Bounds, localRoot: Container): void
    {
        addMaskLocalBounds(this.mask, bounds, localRoot);
    }

    containsPoint(point: PointData): boolean
    {
        const mask = this.mask as any;

        if (mask.containsPoint)
        {
            return mask.containsPoint(point);
        }

        return false;
    }
}
