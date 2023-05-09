import { BigPool } from '../../../utils/pool/PoolGroup';

import type { PoolItem } from '../../../utils/pool/Pool';
import type { Effect } from '../../scene/Effect';

interface MaskConversionTest
{
    test: (item: any) => boolean;
    maskClass: new (item: any) => Effect & PoolItem;
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
