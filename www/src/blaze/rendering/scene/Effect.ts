import type { PointData } from '../../maths/PointData.js';
import type { Bounds } from './bounds/Bounds.js';
import type { Container } from './Container.js';

export interface Effect
{
    pipe: string
    priority: number
    addBounds?(bounds: Bounds): void
    addLocalBounds?(bounds: Bounds, localRoot: Container): void
    containsPoint?(point: PointData): boolean
}
