// import { SHAPES } from '../const';
import type { SHAPE_PRIMITIVE } from './const';
import type { Rectangle } from './shapes/Rectangle';
import type { ShapePrimitive } from './shapes/ShapePrimitive';

/**
 * Size object, contains width and height
 * @memberof PIXI
 * @typedef {object} ISize
 * @property {number} width - Width component
 * @property {number} height - Height component
 */

/**
 * Rectangle object is an area defined by its position, as indicated by its top-left corner
 * point (x, y) and by its width and its height.
 * @memberof PIXI
 */
export class Triangle implements ShapePrimitive
{
    readonly type: SHAPE_PRIMITIVE = 'triangle';

    x: number;
    y: number;
    x2: number;
    y2: number;
    x3: number;
    y3: number;

    constructor(x: number, y: number, x2: number, y2: number, x3: number, y3: number)
    {
        this.x = x;
        this.y = y;
        this.x2 = x2;
        this.y2 = y2;
        this.x3 = x3;
        this.y3 = y3;
    }

    contains(x: number, y: number): boolean
    {
        throw new Error('Method not implemented.', x, y);
    }

    clone(): ShapePrimitive
    {
        throw new Error('Method not implemented.');
    }
    getBounds(out?: Rectangle): Rectangle
    {
        throw new Error('Method not implemented.', out);
    }
}
