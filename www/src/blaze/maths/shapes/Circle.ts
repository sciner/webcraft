import { Rectangle } from './Rectangle';

import type { SHAPE_PRIMITIVE } from '../const';
import type { ShapePrimitive } from './ShapePrimitive';

/**
 * The Circle object is used to help draw graphics and can also be used to specify a hit area for displayObjects.
 * @memberof PIXI
 */
export class Circle implements ShapePrimitive
{
    /** @default 0 */
    public x: number;

    /** @default 0 */
    public y: number;

    /** @default 0 */
    public radius: number;

    /**
     * The type of the object, mainly used to avoid `instanceof` checks
     * @default PIXI.SHAPES.CIRC
     * @see PIXI.SHAPES
     */
    public readonly type: SHAPE_PRIMITIVE = 'circle';

    /**
     * @param x - The X coordinate of the center of this circle
     * @param y - The Y coordinate of the center of this circle
     * @param radius - The radius of the circle
     */
    constructor(x = 0, y = 0, radius = 0)
    {
        this.x = x;
        this.y = y;
        this.radius = radius;
    }

    /**
     * Creates a clone of this Circle instance
     * @returns A copy of the Circle
     */
    clone(): Circle
    {
        return new Circle(this.x, this.y, this.radius);
    }

    /**
     * Checks whether the x and y coordinates given are contained within this circle
     * @param x - The X coordinate of the point to test
     * @param y - The Y coordinate of the point to test
     * @returns Whether the x/y coordinates are within this Circle
     */
    contains(x: number, y: number): boolean
    {
        if (this.radius <= 0)
        {
            return false;
        }

        const r2 = this.radius * this.radius;
        let dx = (this.x - x);
        let dy = (this.y - y);

        dx *= dx;
        dy *= dy;

        return (dx + dy <= r2);
    }

    /**
     * Returns the framing rectangle of the circle as a Rectangle object
     * @param out
     * @returns The framing rectangle
     */
    getBounds(out?: Rectangle): Rectangle
    {
        out = out || new Rectangle();

        out.x = this.x - this.radius;
        out.y = this.y - this.radius;
        out.width = this.radius * 2;
        out.height = this.radius * 2;

        return out;
    }

    // #if _DEBUG
    toString(): string
    {
        return `[@pixi/math:Circle x=${this.x} y=${this.y} radius=${this.radius}]`;
    }
    // #endif
}
