import { MaskEffectManager } from './MaskEffectManager';

import type { PoolItem } from '../../../utils/pool/Pool';
import type { Effect } from '../../scene/Effect';

export class ColorMask implements Effect, PoolItem
{
    priority = 0;
    mask: number;
    pipe = 'colorMask';

    constructor(options: {mask: number})
    {
        if (options?.mask)
        {
            this.init(options.mask);
        }
    }

    init(mask: number): void
    {
        this.mask = mask;
    }
}

MaskEffectManager.add({
    test: (mask: any) => typeof mask === 'number',
    maskClass: ColorMask
});
