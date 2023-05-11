import { Matrix } from '../../../maths/Matrix.js';
import { Bounds } from '../../scene/bounds/Bounds.js';
import { getGlobalBounds } from '../../scene/bounds/getGlobalBounds.js';
import { getLocalBounds, getMatrixRelativeToParent } from '../../scene/bounds/getLocalBounds.js';

import type { Container } from '../../scene/Container';

const tempBounds = new Bounds();

export function addMaskBounds(mask: Container, bounds: Bounds): void
{
    const boundsToMask = tempBounds;

    mask.measurable = true;

    getGlobalBounds(mask, false, boundsToMask);
    bounds.addBoundsMask(boundsToMask);

    mask.measurable = false;
}

export function addMaskLocalBounds(mask: Container, bounds: Bounds, localRoot: Container): void
{
    const boundsToMask = tempBounds;

    const matrix = new Matrix();

    mask.measurable = true;

    getMatrixRelativeToParent(mask, localRoot, matrix);

    getLocalBounds(mask, matrix, boundsToMask);

    mask.measurable = false;

    bounds.addBoundsMask(boundsToMask);
}
