import type { PointData } from '../../maths/PointData';
import type { Bounds } from './bounds/Bounds';
import type { Container } from './Container';

export interface Effect
{
    pipe: string
    priority: number
    addBounds?(bounds: Bounds): void
    addLocalBounds?(bounds: Bounds, localRoot: Container): void
    containsPoint?(point: PointData): boolean
}
