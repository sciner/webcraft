import { EventEmitter } from '../utils/EventEmitter.js';
import { DEG_TO_RAD, RAD_TO_DEG } from '../../maths/const.js';
import { Matrix } from '../../maths/Matrix.js';
import { ObservablePoint } from '../../maths/ObservablePoint.js';
import { Point } from '../../maths/Point.js';
import { removeItems } from '../../utils/data/removeItems.js';
import { getFilterEffect, returnFilterEffect } from '../filters/FilterEffect.js';
import { MaskEffectManager } from '../mask/shared/MaskEffectManager.js';
import { BLEND_MODES } from '../renderers/shared/state/const.js';
import { Bounds } from './bounds/Bounds.js';
import { updateParents } from './bounds/getGlobalBounds.js';
import { getLocalBounds } from './bounds/getLocalBounds.js';
import { RenderGroup } from './RenderGroup.js';
import { updateLocalTransform } from './utils/updateLocalTransform.js';
import { updateWorldTransform } from './utils/updateWorldTransform.js';

import type { PointData } from '../../maths/PointData.js';
import type { Dict } from '../../utils/types.js';
import type { Filter } from '../filters/Filter.js';
import type { FilterEffect } from '../filters/FilterEffect.js';
import type { Renderable } from '../renderers/shared/Renderable.js';
import type { Effect } from './Effect.js';

const tempBounds = new Bounds();
const tempMatrix = new Matrix();

// A funny performance saving technique.
const allMatrix: Matrix[] = [];
const freeIndexes: number[] = [];

export const UPDATE_COLOR = 0b0001;
export const UPDATE_BLEND = 0b0010;
export const UPDATE_VISIBLE = 0b0100;

// is its visible... it should
// TODO implement!
export const UPDATE_TRANSFORM = 0b1000;

function getMatrixIndex(): number
{
    if (freeIndexes.length > 0)
    {
        return freeIndexes.pop();
    }

    allMatrix.push(new Matrix());

    return allMatrix.length - 1;
}

// as pivot and skew are the least used properties of a container, we can use this optimisation
// to avoid allocating lots of unnecessary objects for them.
const defaultSkew = new ObservablePoint(null);
const defaultPivot = new ObservablePoint(null);
const defaultScale = new ObservablePoint(null, 1, 1);

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ContainerEvents extends PixiMixins.ContainerEvents
{
    added: [container: Container];
    childAdded: [child: Container, container: Container, index: number];
    removed: [container: Container];
    childRemoved: [child: Container, container: Container, index: number];
    // TODO: add destroy event
    // destroyed: [];
}

export interface Container
    extends Omit<PixiMixins.Container, keyof EventEmitter<ContainerEvents>>,
    EventEmitter<ContainerEvents> {}

export class Container<T extends Renderable = Renderable> extends EventEmitter<ContainerEvents>
{
    label = '';
    id = '';

    public isSimple = true;
    public colorBlendVisibleUpdate = 0b1111;

    // renderGroup //
    // if it has its own render group.. this will be rendered as a separate set of instructions
    public layer = 1;

    // if this exists, then this container will be rendered as a separate set of instructions
    public renderGroup: RenderGroup;

    // the parent of this container in the scene graph
    public parent: Container;

    // reference to the renderGroup this container will be rendered in
    public parentRenderGroup: RenderGroup;

    // this will be an identity if a container owns a render group!
    public parentTransform: Container;

    // a renderable object... like a sprite!
    public renderable: T;

    // transform data..
    /** The coordinate of the object relative to the local coordinates of the parent. */
    public position: ObservablePoint = new ObservablePoint(this, 0, 0);

    /** The scale factor of the object. */
    public _scale: ObservablePoint = defaultScale;

    /** The pivot point of the displayObject that it rotates around. */
    public _pivot: ObservablePoint = defaultPivot;

    /** The skew amount, on the x and y axis. */
    public _skew: ObservablePoint = defaultSkew;

    /** The locally unique ID of the parent's world transform used to calculate the current world transformation matrix. */
    public _parentWorldTransformID = 0;

    /** The locally unique ID of the world transform. */
    public _worldTransformID = 0;

    /** The rotation amount. */
    public _rotation = 0;

    /** The locally unique ID of the local transform. */
    public _localTransformID = 0;
    /** The locally unique ID of the local transform used to calculate the current local transformation matrix. */
    public _currentLocalTransformID = 0;

    public isUpdatedThisFrame = 0;

    public rTick = -1;

    public worldTransformIndex = getMatrixIndex();
    public localTransformIndex = getMatrixIndex();

    /**
     * The X-coordinate value of the normalized local X axis,
     * the first column of the local transformation matrix without a scale.
     */
    public _cx = 1;

    /**
     * The Y-coordinate value of the normalized local X axis,
     * the first column of the local transformation matrix without a scale.
     */
    public _sx = 0;

    /**
     * The X-coordinate value of the normalized local Y axis,
     * the second column of the local transformation matrix without a scale.
     */
    public _cy = 0;

    /**
     * The Y-coordinate value of the normalized local Y axis,
     * the second column of the local transformation matrix without a scale.
     */
    public _sy = 1;

    // scene graph children
    public readonly children: Container[] = [];

    // masking..
    _mask?: {mask: unknown, effect: Effect} = null;

    // filters..
    _filters: {filters: Filter[], effect: FilterEffect} = null;

    _localBlendMode = BLEND_MODES.INHERIT;
    worldBlendMode = BLEND_MODES.NORMAL; // this is set to normal if

    // color
    _localAlpha = 1;
    worldAlpha = 1;

    _localTint = 0xFFFFFF;
    worldTint = 0xFFFFFF;
    worldTintAlpha = 0xFFFFFFFF;

    // visibility
    // 0b11
    // first bit is visible, second bit is renderable
    _localVisibleRenderable = 0b11;
    worldVisibleRenderable = -1;

    // should the container be measured when calculating the bounds?
    // TODO rename.. to something with the words Bounds in it
    measurable = true;

    // used internally for changing up the render order.. mainly for masks and filters
    // TODO setting this should cause a rebuild??
    includeInBuild = true;

    // sorting..
    sceneDepth = 0;

    // magic layer!
    effects: Effect[] = [];

    _onRender: () => void;

    set tint(value: number)
    {
        if (this._localTint === value) return;

        this.colorBlendVisibleUpdate |= UPDATE_COLOR;
        this._localTint = value;

        this.onChange();
    }

    get tint(): number
    {
        return this._localTint;
    }

    get alpha()
    {
        return this._localAlpha;
    }

    set alpha(value: number)
    {
        if (this._localAlpha === value) return;

        this.colorBlendVisibleUpdate |= UPDATE_COLOR;
        this._localAlpha = value;

        this.onChange();
    }

    set blendMode(value: BLEND_MODES)
    {
        if (this._localBlendMode === value) return;

        if (this.renderable && this.parentRenderGroup)
        {
            const didChangeToAdvanced = this._localBlendMode < (1 << 4) && value >= (1 << 4);

            if (this.renderable.batched || didChangeToAdvanced)
            {
                this.parentRenderGroup.onStructureChange();
            }
        }

        this.colorBlendVisibleUpdate |= UPDATE_BLEND;
        this._localBlendMode = value;
    }

    get blendMode(): number
    {
        return this._localBlendMode;
    }

    get worldTransform()
    {
        return allMatrix[this.worldTransformIndex];
    }

    get localTransform()
    {
        return allMatrix[this.localTransformIndex];
    }

    set mask(value: unknown)
    {
        this._mask ||= { mask: null, effect: null };

        if (this._mask.mask === value) return;

        if (this._mask.effect)
        {
            this.removeEffect(this._mask.effect);

            MaskEffectManager.returnMaskEffect(this._mask.effect);

            this._mask.effect = null;
        }

        this._mask.mask = value;

        if (value === null || value === undefined) return;

        const effect = MaskEffectManager.getMaskEffect(value);

        this._mask.effect = effect;

        this.addEffect(effect);
    }

    get mask(): unknown
    {
        return this._mask?.mask;
    }

    set filters(value: Filter[])
    {
        // TODO - not massively important, but could optimise here
        // by reusing the same effect.. rather than adding and removing from the pool!
        this._filters ||= { filters: null, effect: null };

        if (this._filters.filters === value) return;

        if (this._filters.effect)
        {
            this.removeEffect(this._filters.effect);
            returnFilterEffect(this._filters.effect);
            this._filters.effect = null;
        }

        this._filters.filters = value;

        if (!value) return;

        const effect = getFilterEffect(value);

        this._filters.effect = effect;

        this.addEffect(effect);
    }

    get filters(): Filter[]
    {
        return this._filters?.filters;
    }

    addEffect(effect: Effect)
    {
        const index = this.effects.indexOf(effect);

        if (index !== -1) return; // already exists!

        this.effects.push(effect);

        this.effects.sort((a, b) => a.priority - b.priority);

        this.parentRenderGroup?.onStructureChange();

        this.updateIsSimple();
    }

    removeEffect(effect: Effect)
    {
        const index = this.effects.indexOf(effect);

        if (index === -1) return; // already exists!

        this.effects.splice(index, 1);

        this.parentRenderGroup?.onStructureChange();

        this.updateIsSimple();
    }

    attachRenderGroup(): void
    {
        if (this.renderGroup) return;

        this.layer = 0;

        this.renderGroup = new RenderGroup(this);

        if (this.parentRenderGroup)
        {
            this.parentRenderGroup.addRenderGroup(this.renderGroup);
        }

        //        this.onChange();

        this.updateIsSimple();
    }

    detachRenderGroup(): void
    {
        // TODO - convert it back!
        // TODO pool renderGroups
        // this.layer = 1;

        // if (this.parentRenderGroup)
        // {
        //     this.parentRenderGroup.convertRenderGroupToContainer(this);
        // }
    }

    updateLocalTransform(): void
    {
        const lt = this.localTransform;

        if (this._localTransformID !== this._currentLocalTransformID)
        {
            updateLocalTransform(lt, this);
            this._currentLocalTransformID = this._localTransformID;

            // force an update..
            this._parentWorldTransformID = -1;
        }
    }

    updateWorldTransform(): void
    {
        const wt = this.worldTransform;
        const lt = this.localTransform;

        if (this.parentTransform)
        {
            const parent = this.parentTransform;

            if (this._parentWorldTransformID !== parent._worldTransformID)
            {
                // concat the parent matrix with the objects transform.
                const pt = parent.worldTransform;

                updateWorldTransform(lt, pt, wt);

                this._parentWorldTransformID = parent._worldTransformID;

                // update the id of the transform..
                this._worldTransformID++;
            }
        }
        else
        {
            wt.copyFrom(lt);

            if (this._parentWorldTransformID === -1)
            {
                this._parentWorldTransformID = 0;
                this._worldTransformID++;
            }
        }
    }

    /**
     * Called when a value changes.
     * @param point
     */
    onChange(point?: ObservablePoint): void
    {
        this._localTransformID++;

        if (point === this._skew)
        {
            this.updateSkew();
        }

        if (this.isUpdatedThisFrame++ !== 0 || !this.parentRenderGroup) return;

        this.parentRenderGroup.onChange(this);
    }

    /** Called when the skew or the rotation changes. */
    protected updateSkew(): void
    {
        const rotation = this._rotation;
        const skew = this._skew;

        this._cx = Math.cos(rotation + skew._y);
        this._sx = Math.sin(rotation + skew._y);
        this._cy = -Math.sin(rotation - skew._x); // cos, added PI/2
        this._sy = Math.cos(rotation - skew._x); // sin, added PI/2
    }

    /**
     * Adds one or more children to the container.
     *
     * Multiple items can be added like so: `myContainer.addChild(thingOne, thingTwo, thingThree)`
     * @param {...PIXI.Container} children - The Container(s) to add to the container
     * @returns {PIXI.Container} - The first child that was added.
     */
    addChild<U extends Container[]>(...children: Container[]): U[0]
    {
        if (children.length > 1)
        {
            // loop through the array and add all children
            for (let i = 0; i < children.length; i++)
            {
                this.addChild(children[i]);
            }

            return children[0];
        }

        const child = children[0];

        this.addChildAt(child, this.children.length);

        return child;
    }

    /**
     * Adds a child to the container at a specified index. If the index is out of bounds an error will be thrown
     * @param {PIXI.Container} child - The child to add
     * @param {number} index - The index to place the child in
     * @returns {PIXI.Container} The child that was added.
     */
    addChildAt<U extends Container>(child: U, index: number): U
    {
        const { children } = this;

        if (index < 0 || index > children.length)
        {
            throw new Error(`${child}addChildAt: The index ${index} supplied is out of bounds ${children.length}`);
        }

        // TODO - check if child is already in the list?
        // we should be able to optimise this!

        if (child.parent)
        {
            const currentIndex = child.parent.children.indexOf(child);

            // If this child is in the container and in the same position, do nothing
            if (child.parent === this && currentIndex === index)
            {
                return child;
            }

            if (currentIndex !== -1)
            {
                child.parent.children.splice(currentIndex, 1);
            }
        }

        child.parent = this;

        child.parentTransform = this;

        if (index === children.length)
        {
            children.push(child);
        }
        else
        {
            children.splice(index, 0, child);
        }

        const stage = this.renderGroup || this.parentRenderGroup;

        if (stage)
        {
            // TODO make an optimise swap child!
            stage.addChild(child);
        }

        this.emit('childAdded', child, this, index);
        child.emit('added', this);

        return child;
    }

    /**
     * Returns the index position of a child Container instance
     * @param child - The Container instance to identify
     * @returns - The index position of the child display object to identify
     */
    getChildIndex(child: Container): number
    {
        const index = this.children.indexOf(child);

        if (index === -1)
        {
            throw new Error('The supplied Container must be a child of the caller');
        }

        return index;
    }

    // TODO: setChildIndex
    // TODO: swapChildren

    /**
     * Changes the position of an existing child in the display object container
     * @param child - The child Container instance for which you want to change the index number
     * @param index - The resulting index number for the child display object
     */
    setChildIndex(child: Container, index: number): void
    {
        if (index < 0 || index >= this.children.length)
        {
            throw new Error(`The index ${index} supplied is out of bounds ${this.children.length}`);
        }

        this.addChildAt(child, index);
    }

    /**
     * Returns the child at the specified index
     * @param index - The index to get the child at
     * @returns - The child at the given index, if any.
     */
    getChildAt<U extends Container>(index: number): U
    {
        if (index < 0 || index >= this.children.length)
        {
            throw new Error(`getChildAt: Index (${index}) does not exist.`);
        }

        return this.children[index] as U;
    }

    /**
     * Removes one or more children from the container.
     * @param {...PIXI.Container} children - The Container(s) to remove
     * @returns {PIXI.Container} The first child that was removed.
     */
    removeChild<U extends Container[]>(...children: U): U[0]
    {
        // if there is only one argument we can bypass looping through the them
        if (children.length > 1)
        {
            // loop through the arguments property and remove all children
            for (let i = 0; i < children.length; i++)
            {
                this.removeChild(children[i]);
            }

            return children[0];
        }

        const child = children[0];

        const index = this.children.indexOf(child);

        if (index !== -1)
        {
            this.children.splice(index, 1);

            const stage = this.renderGroup || this.parentRenderGroup;

            if (stage)
            {
                stage.removeChild(child);
            }

            child.parent = null;

            this.emit('childRemoved', child, this, index);
            child.emit('removed', this);
        }

        return child;
    }

    /**
     * Removes a child from the specified index position.
     * @param index - The index to get the child from
     * @returns The child that was removed.
     */
    removeChildAt<U extends Container>(index: number): U
    {
        const child = this.getChildAt(index);

        return this.removeChild(child) as U;
    }

    /**
     * Removes all children from this container that are within the begin and end indexes.
     * @param beginIndex - The beginning position.
     * @param endIndex - The ending position. Default value is size of the container.
     * @returns - List of removed children
     */
    removeChildren(beginIndex = 0, endIndex = this.children.length): Container[]
    {
        const end = endIndex;
        const range = end - beginIndex;
        const removed: Container[] = [];

        if (range > 0 && range <= end)
        {
            for (let i = endIndex - 1; i >= beginIndex; i--)
            {
                const child = this.children[i];

                const stage = this.renderGroup || this.parentRenderGroup;

                if (stage)
                {
                    stage.removeChild(child);
                }

                removed.push(child);
                child.parent = null;
            }

            removeItems(this.children, beginIndex, endIndex);

            for (let i = 0; i < removed.length; ++i)
            {
                this.emit('childRemoved', removed[i], this, i);
                removed[i].emit('removed', this);
            }

            return removed;
        }
        else if (range === 0 && this.children.length === 0)
        {
            return removed;
        }

        throw new RangeError('removeChildren: numeric values are outside the acceptable range.');
    }

    get width(): number
    {
        return this.scale.x * getLocalBounds(this, tempMatrix, tempBounds).width;
    }

    set width(value: number)
    {
        this.scale.x = value / getLocalBounds(this, tempMatrix, tempBounds).width;
    }

    get height(): number
    {
        return this.scale.y * getLocalBounds(this, tempMatrix, tempBounds).height;
    }

    set height(value: number)
    {
        this.scale.y = value / getLocalBounds(this, tempMatrix, tempBounds).height;
    }

    get visible()
    {
        return !!(this._localVisibleRenderable & 0b10);
    }

    // visible -  the renderable is not shown, also the transform is not updated
    set visible(value: boolean)
    {
        const valueNumber = value ? 1 : 0;

        if ((this._localVisibleRenderable & 0b10) >> 1 === valueNumber) return;

        this._localVisibleRenderable = (this._localVisibleRenderable & 0b01) | (valueNumber << 1);

        this.colorBlendVisibleUpdate |= UPDATE_VISIBLE;

        this.onChange();
    }

    get isRenderable()
    {
        return !!(this._localVisibleRenderable & 0b10);
    }

    // isRenderable - transform is updated, but the renderable is not shown
    set isRenderable(value: boolean)
    {
        const valueNumber = value ? 1 : 0;

        if ((this._localVisibleRenderable & 0b01) === valueNumber) return;

        this._localVisibleRenderable = (this._localVisibleRenderable & 0b10) | valueNumber;

        this.colorBlendVisibleUpdate |= UPDATE_VISIBLE;

        this.onChange();
    }

    /**
     * The position of the displayObject on the x axis relative to the local coordinates of the parent.
     * An alias to position.x
     */
    get x(): number
    {
        return this.position.x;
    }

    set x(value: number)
    {
        this.position.x = value;
    }

    /**
     * The position of the displayObject on the y axis relative to the local coordinates of the parent.
     * An alias to position.y
     */
    get y(): number
    {
        return this.position.y;
    }

    set y(value: number)
    {
        this.position.y = value;
    }

    // /**
    //   * Current transform of the object based on world (parent) factors.
    //   * @readonly
    //   */

    /**
     * The coordinate of the object relative to the local coordinates of the parent.
     * @since 4.0.0
     */

    /**
     * The scale factors of this object along the local coordinate axes.
     *
     * The default scale is (1, 1).
     * @since 4.0.0
     */

    /**
     * The center of rotation, scaling, and skewing for this display object in its local space. The `position`
     * is the projection of `pivot` in the parent's local space.
     *
     * By default, the pivot is the origin (0, 0).
     * @since 4.0.0
     */

    /**
     * The skew factor for the object in radians.
     * @since 4.0.0
     */

    /**
     * The rotation of the object in radians.
     * 'rotation' and 'angle' have the same effect on a display object; rotation is in radians, angle is in degrees.
     */
    get rotation(): number
    {
        return this._rotation;
    }

    set rotation(value: number)
    {
        if (this._rotation !== value)
        {
            this._rotation = value;
            this.onChange(this._skew);
        }
    }

    /**
     * The angle of the object in degrees.
     * 'rotation' and 'angle' have the same effect on a display object; rotation is in radians, angle is in degrees.
     */
    get angle(): number
    {
        return this.rotation * RAD_TO_DEG;
    }

    set angle(value: number)
    {
        this.rotation = value * DEG_TO_RAD;
    }

    get pivot(): ObservablePoint
    {
        if (this._pivot === defaultPivot)
        {
            this._pivot = new ObservablePoint(this, 0, 0);
        }

        return this._pivot;
    }

    get skew(): ObservablePoint
    {
        if (this._skew === defaultSkew)
        {
            this._skew = new ObservablePoint(this, 0, 0);
        }

        return this._skew;
    }

    get scale(): ObservablePoint
    {
        if (this._scale === defaultScale)
        {
            this._scale = new ObservablePoint(this, 1, 1);
        }

        return this._scale;
    }

    updateIsSimple()
    {
        this.isSimple = !(this.renderGroup || this.effects.length || this._filters);
    }

    getGlobalPosition(point: Point = new Point(), skipUpdate = false): Point
    {
        if (this.parent)
        {
            this.parent.toGlobal(this.position, point, skipUpdate);
        }
        else
        {
            point.x = this.position.x;
            point.y = this.position.y;
        }

        return point;
    }

    /**
     * Calculates the global position of the display object.
     * @param position - The world origin to calculate from.
     * @param point - A Point object in which to store the value, optional
     *  (otherwise will create a new Point).
     * @param skipUpdate - Should we skip the update transform.
     * @returns - A point object representing the position of this object.
     */
    toGlobal<P extends PointData = Point>(position: PointData, point?: P, skipUpdate = false): P
    {
        if (!skipUpdate)
        {
            updateParents(this);

            this.updateLocalTransform();
            this.updateWorldTransform();
        }

        // don't need to update the lot
        return this.worldTransform.apply<P>(position, point);
    }

    /**
     * Calculates the local position of the display object relative to another point.
     * @param position - The world origin to calculate from.
     * @param from - The DisplayObject to calculate the global position from.
     * @param point - A Point object in which to store the value, optional
     *  (otherwise will create a new Point).
     * @param skipUpdate - Should we skip the update transform
     * @returns - A point object representing the position of this object
     */
    toLocal<P extends PointData = Point>(position: PointData, from?: Container, point?: P, skipUpdate?: boolean): P
    {
        if (from)
        {
            position = from.toGlobal(position, point, skipUpdate);
        }

        if (!skipUpdate)
        {
            updateParents(this);

            this.updateLocalTransform();
            this.updateWorldTransform();
        }

        // simply apply the matrix..
        return this.worldTransform.applyInverse<P>(position, point);
    }

    set onRender(func: () => void)
    {
        const stage = this.renderGroup || this.parentRenderGroup;

        if (!func)
        {
            if (this._onRender)
            {
                stage?.removeOnRender(this);
            }

            this._onRender = null;

            return;
        }

        if (!this._onRender)
        {
            stage?.addOnRender(this);
        }

        this._onRender = func;
    }

    get onRender(): () => void
    {
        return this._onRender;
    }

    static IDENTITY: Container = new Container();

    /**
     * Mixes all enumerable properties and methods from a source object to Container.
     * @param source - The source of properties and methods to mix in.
     */
    static mixin(source: Dict<any>): void
    {
        Object.defineProperties(Container.prototype, Object.getOwnPropertyDescriptors(source));
    }
}
