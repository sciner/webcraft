import type { SHAPE_PRIMITIVE } from '../const.js';
import type { Rectangle } from './Rectangle.js';

export interface ShapePrimitive
{
    readonly type: SHAPE_PRIMITIVE

    contains(x: number, y: number): boolean;
    clone(): ShapePrimitive;
    getBounds(out?: Rectangle): Rectangle;

    readonly x: number;
    readonly y: number;
}
