import { Sprite } from '../../sprite/shared/Sprite';
import { addMaskBounds, addMaskLocalBounds } from './addMaskBounds';
import { MaskEffectManager } from './MaskEffectManager';

import type { PointData } from '../../../maths/PointData';
import type { PoolItem } from '../../../utils/pool/Pool';
import type { Bounds } from '../../scene/bounds/Bounds';
import type { Container } from '../../scene/Container';
import type { Effect } from '../../scene/Effect';

export class AlphaMask implements Effect, PoolItem
{
    priority = 0;
    mask: Container;
    pipe = 'alphaMask';
    renderMaskToTexture: boolean;

    constructor(options?: {mask: Container})
    {
        if (options?.mask)
        {
            this.init(options.mask);
        }
    }

    init(mask: Container): void
    {
        this.mask = mask;

        // TODO - might want to change this to adjust on the fly
        // user may add children to the sprite..
        this.renderMaskToTexture = !(mask instanceof Sprite);

        this.mask.isRenderable = this.renderMaskToTexture;
        this.mask.includeInBuild = !this.renderMaskToTexture;

        this.mask.measurable = false;
    }

    reset()
    {
        this.mask.measurable = true;
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
    test: (mask: any) => mask instanceof Sprite,
    maskClass: AlphaMask,
});
