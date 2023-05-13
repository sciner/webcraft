import { MaskEffectManager } from './MaskEffectManager.js';

import type { PoolItem } from '../../../utils/pool/Pool.js';
import type { Effect } from '../../scene/Effect.js';

export class ColorMask implements Effect, PoolItem
{
    priority = 0;
    mask: number;
    pipe = 'colorMask';

    constructor(options?: {mask: number})
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
