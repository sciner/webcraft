import type { PointData } from './PointData.js';
import type { PointLike } from './PointLike.js';

interface Observer
{
    onChange: (point?: ObservablePoint) => void;
}
/**
 * The ObservablePoint object represents a location in a two-dimensional coordinate system, where `x` represents
 * the position on the horizontal axis and `y` represents the position on the vertical axis.
 *
 * An `ObservablePoint` is a point that triggers a callback when the point's position is changed.
 * @memberof PIXI
 */
export class ObservablePoint implements PointLike
{
    _x: number;
    _y: number;
    observer: Observer;

    /**
     * Creates a new `ObservablePoint`
     * @param observer
     * @param {number} [x=0] - position of the point on the x axis
     * @param {number} [y=0] - position of the point on the y axis
     */
    constructor(observer: Observer, x?: number, y?: number)
    {
        this._x = x || 0;
        this._y = y || 0;

        this.observer = observer;
    }

    /**
     * Creates a clone of this point.
     * The callback and scope params can be overridden otherwise they will default
     * to the clone object's values.
     * @override
     * @returns a copy of this observable point
     */
    clone(container: Observer): ObservablePoint
    {
        return new ObservablePoint(container, this._x, this._y);
    }

    /**
     * Sets the point to a new `x` and `y` position.
     * If `y` is omitted, both `x` and `y` will be set to `x`.
     * @param {number} [x=0] - position of the point on the x axis
     * @param {number} [y=x] - position of the point on the y axis
     * @returns The observable point instance itself
     */
    set(x = 0, y = x): this
    {
        if (this._x !== x || this._y !== y)
        {
            this._x = x;
            this._y = y;
            this.observer.onChange();
        }

        return this;
    }

    /**
     * Copies x and y from the given point (`p`)
     * @param p - The point to copy from. Can be any of type that is or extends `PointData`
     * @returns The observable point instance itself
     */
    copyFrom(p: PointData): this
    {
        if (this._x !== p.x || this._y !== p.y)
        {
            this._x = p.x;
            this._y = p.y;
            this.observer.onChange();
        }

        return this;
    }

    /**
     * Copies this point's x and y into that of the given point (`p`)
     * @param p - The point to copy to. Can be any of type that is or extends `PointData`
     * @returns The point (`p`) with values updated
     */
    copyTo<T extends PointLike>(p: T): T
    {
        p.set(this._x, this._y);

        return p;
    }

    /**
     * Accepts another point (`p`) and returns `true` if the given point is equal to this point
     * @param p - The point to check
     * @returns Returns `true` if both `x` and `y` are equal
     */
    equals(p: PointData): boolean
    {
        return (p.x === this._x) && (p.y === this._y);
    }

    // #if _DEBUG
    toString(): string
    {
        return `[@pixi/math:ObservablePoint x=${0} y=${0} scope=${this.observer}]`;
    }
    // #endif

    /** Position of the observable point on the x axis. */
    get x(): number
    {
        return this._x;
    }

    set x(value: number)
    {
        if (this._x !== value)
        {
            this._x = value;
            this.observer.onChange(this);
        }
    }

    /** Position of the observable point on the y axis. */
    get y(): number
    {
        return this._y;
    }

    set y(value: number)
    {
        if (this._y !== value)
        {
            this._y = value;
            this.observer.onChange(this);
        }
    }
}
