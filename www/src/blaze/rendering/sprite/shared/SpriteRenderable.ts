import { ObservablePoint } from '../../../maths/ObservablePoint';
import { Point } from '../../../maths/Point';
import { NOOP } from '../../../utils/NOOP';

import type { Matrix } from '../../../maths/Matrix';
import type { PointData } from '../../../maths/PointData';
import type { InstructionSet } from '../../renderers/shared/instructions/InstructionSet';
import type { Renderable, RenderableData } from '../../renderers/shared/Renderable';
import type { Texture } from '../../renderers/shared/texture/Texture';
import type { Bounds } from '../../scene/bounds/Bounds';

let uid = 0;

export class SpriteRenderable implements Renderable
{
    // sprite specific..
    _texture: Texture;
    anchor: ObservablePoint;

    batched = true;

    buildId = 0;
    uid = uid++;

    matrix: Matrix;

    visible = true;

    type = 'sprite';

    onRenderableUpdate = NOOP;

    renderableUpdateRequested = false;
    instructionSet: InstructionSet;

    _bounds: [number, number, number, number] = [0, 1, 0, 0];
    _sourceBounds: [number, number, number, number] = [0, 1, 0, 0];

    boundsDirty = true;
    sourceBoundsDirty = true;

    data: RenderableData;

    constructor(texture: Texture, renderableData: RenderableData)
    {
        this.anchor = new ObservablePoint(
            this,
            texture.layout.defaultAnchor?.x || 0,
            texture.layout.defaultAnchor?.y || 0,
        );

        this.texture = texture;

        this.data = renderableData;

        this.matrix = renderableData.worldTransform;
    }

    set texture(value: Texture)
    {
        if (this._texture === value) return;

        value.onTextureUpdate.remove(this);

        this._texture = value;

        value.onTextureUpdate.add(this);

        this.onChange();
    }

    get texture()
    {
        return this._texture;
    }

    get bounds()
    {
        if (this.boundsDirty)
        {
            this.updateBounds();
            this.boundsDirty = false;
        }

        return this._bounds;
    }

    get sourceBounds()
    {
        if (this.sourceBoundsDirty)
        {
            this.updateSourceBounds();
            this.sourceBoundsDirty = false;
        }

        return this._sourceBounds;
    }

    updateBounds()
    {
        const texture = this._texture;
        const textureSource = texture._source;

        const layout = texture.layout;

        const orig = layout.orig;
        const trim = layout.trim;

        const textureSourceWidth = textureSource.width;
        const textureSourceHeight = textureSource.height;

        const width = textureSourceWidth * orig.width;
        const height = textureSourceHeight * orig.height;

        const anchor = this.anchor;
        const bounds = this._bounds;

        if (trim)
        {
            const sourceWidth = textureSourceWidth * trim.width;
            const sourceHeight = textureSourceHeight * trim.height;

            bounds[1] = (trim.x * textureSourceWidth) - (anchor._x * width);
            bounds[0] = bounds[1] + sourceWidth;

            bounds[3] = (trim.y * textureSourceHeight) - (anchor._y * height);
            bounds[2] = bounds[3] + sourceHeight;
        }
        else
        {
            bounds[1] = -anchor._x * width;
            bounds[0] = bounds[1] + width;

            bounds[3] = -anchor._y * height;
            bounds[2] = bounds[3] + height;
        }

        return;
    }

    updateSourceBounds()
    {
        const anchor = this.anchor;
        const texture = this._texture;

        const textureSource = texture._source;
        const layout = texture.layout;

        const orig = layout.orig;

        const sourceBounds = this._sourceBounds;

        const width = textureSource.width * orig.width;
        const height = textureSource.height * orig.height;

        sourceBounds[1] = -anchor._x * width;
        sourceBounds[0] = sourceBounds[1] + width;

        sourceBounds[3] = -anchor._y * height;
        sourceBounds[2] = sourceBounds[3] + height;
    }

    addBounds(bounds: Bounds)
    {
        const trim = this._texture._layout.trim;

        if (trim)
        {
            const sourceBounds = this.sourceBounds;

            bounds.addFrame(sourceBounds[0], sourceBounds[2], sourceBounds[1], sourceBounds[3]);
        }
        else
        {
            const _bounds = this.bounds;

            bounds.addFrame(_bounds[0], _bounds[2], _bounds[1], _bounds[3]);
        }
    }

    onChange()
    {
        this.boundsDirty = true;
        this.onRenderableUpdate();
    }

    containsPoint(point: PointData)
    {
        const position = this.data.worldTransform.applyInverse(point, Point.shared);

        const width = this._texture.frameWidth;
        const height = this._texture.frameHeight;
        const x1 = -width * this.anchor.x;
        let y1 = 0;

        if (position.x >= x1 && position.x < x1 + width)
        {
            y1 = -height * this.anchor.y;

            if (position.y >= y1 && position.y < y1 + height)
            {
                return true;
            }
        }

        return false;
    }
}
