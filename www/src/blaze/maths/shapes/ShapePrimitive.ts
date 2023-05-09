import type { SHAPE_PRIMITIVE } from '../const';
import type { Rectangle } from './Rectangle';

export interface ShapePrimitive
{
    readonly type: SHAPE_PRIMITIVE

    contains(x: number, y: number): boolean;
    clone(): ShapePrimitive;
    getBounds(out?: Rectangle): Rectangle;

    readonly x: number;
    readonly y: number;
}
