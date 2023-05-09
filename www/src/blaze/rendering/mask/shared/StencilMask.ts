import { Container } from '../../scene/Container';
import { addMaskBounds, addMaskLocalBounds } from './addMaskBounds';
import { MaskEffectManager } from './MaskEffectManager';

import type { PointData } from '../../../maths/PointData';
import type { PoolItem } from '../../../utils/pool/Pool';
import type { Bounds } from '../../scene/bounds/Bounds';
import type { Effect } from '../../scene/Effect';

export class StencilMask implements Effect, PoolItem
{
    priority = 0;
    mask: Container;
    pipe = 'stencilMask';

    constructor(options: {mask: Container})
    {
        if (options?.mask)
        {
            this.init(options.mask);
        }
    }

    init(mask: Container): void
    {
        this.mask = mask;
        this.mask.includeInBuild = false;
        this.mask.measurable = false;
    }

    reset()
    {
        this.mask.measurable = true;
        this.mask.includeInBuild = true;
        this.mask = null;
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

MaskEffectManager.add({
    test: (mask: any) => mask instanceof Container,
    maskClass: StencilMask,
});
