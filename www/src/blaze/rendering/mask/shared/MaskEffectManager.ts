import { BigPool } from '../../../utils/pool/PoolGroup.js';

import type { PoolItem, PoolItemConstructor } from '../../../utils/pool/Pool.js';
import type { Effect } from '../../scene/Effect.js';

interface MaskConversionTest
{
    test: (item: any) => boolean;
    maskClass: new (item: PoolItemConstructor) => Effect & PoolItem;
}

export class MaskEffectManagerClass
{
    tests: MaskConversionTest[] = [];

    add(test: MaskConversionTest)
    {
        this.tests.push(test);
    }

    getMaskEffect(item: any): Effect
    {
        for (let i = 0; i < this.tests.length; i++)
        {
            const test = this.tests[i];

            if (test.test(item))
            {
                return BigPool.get(test.maskClass, item);
            }
        }

        return item;
    }

    returnMaskEffect(effect: Effect & PoolItem)
    {
        BigPool.return(effect);
    }
}

export const MaskEffectManager = new MaskEffectManagerClass();
