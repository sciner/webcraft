import { Cache } from '../../assets/cache/Cache.js';
import { ObservablePoint } from '../../maths/ObservablePoint.js';
import { Point } from '../../maths/Point.js';
import { NOOP } from '../../utils/NOOP.js';
import { BitmapFontManager } from './bitmap/BitmapFontManager.js';
import { CanvasTextMetrics } from './canvas/CanvasTextMetrics.js';
import { TextStyle } from './TextStyle.js';

import type { Matrix } from '../../maths/Matrix.js';
import type { PointData } from '../../maths/PointData.js';
import type { InstructionSet } from '../renderers/shared/instructions/InstructionSet.js';
import type { Renderable, RenderableData } from '../renderers/shared/Renderable.js';
import type { Bounds } from '../scene/bounds/Bounds.js';
import type { TextStyleOptions } from './TextStyle.js';

let uid = 0;

type Filter<T> = { [K in keyof T]: {
    text?: string;
    renderMode?: K;
    resolution?: number;
    style: T[K]
} } [keyof T];

export type TextStyles = {
    canvas: TextStyleOptions | TextStyle;
    // html: HTMLTextStyle;
    bitmap: TextStyleOptions | TextStyle;
};

export type TextOptions = Filter<TextStyles>;

const map = {
    canvas: 'text',
    html: 'text',
    bitmap: 'bitmapText',
};

export class TextRenderable implements Renderable
{
    static defaultResolution = 1;
    static defaultAutoResolution = true;

    batched = true;

    buildId = 0;
    uid = uid++;

    matrix: Matrix;

    visible = true;

    type = 'text';

    onRenderableUpdate = NOOP;

    renderableUpdateRequested = false;
    instructionSet: InstructionSet;

    _bounds: [number, number, number, number] = [0, 1, 0, 0];

    boundsDirty = true;

    data: RenderableData;
    anchor: ObservablePoint;

    _autoResolution = TextRenderable.defaultAutoResolution;
    _resolution = TextRenderable.defaultResolution;

    readonly renderMode: 'canvas' | 'html' | 'bitmap';

    _style: TextStyle;
    private _text: string;

    constructor(options: TextOptions, renderableData: RenderableData)
    {
        this._text = options.text;
        this._style = options.style instanceof TextStyle ? options.style : new TextStyle(options.style);

        const renderMode = options.renderMode ?? this.detectRenderType(this._style);

        this.type = map[renderMode];

        this.anchor = new ObservablePoint(this, 0, 0);

        this.data = renderableData;

        this._resolution = options.resolution ?? TextRenderable.defaultResolution;

        this.matrix = renderableData.worldTransform;
    }

    set text(value: string)
    {
        // check its a string
        value = value.toString();

        if (this._text === value) return;

        this._text = value;
        this.onChange();
    }

    get text(): string
    {
        return this._text;
    }

    get style(): TextStyle
    {
        return this._style;
    }

    set style(style: TextStyle | Partial<TextStyle>)
    {
        style = style || {};

        if (style instanceof TextStyle)
        {
            this._style = style;
        }
        else
        {
            this._style = new TextStyle(style);
        }

        this.onChange();
    }

    set resolution(value: number)
    {
        this._resolution = value;
    }

    get resolution(): number
    {
        return this._resolution;
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

    updateBounds()
    {
        const bounds = this._bounds;

        if (this.type === 'bitmapText')
        {
            const bitmapMeasurement = BitmapFontManager.measureText(this.text, this._style);

            const scale = bitmapMeasurement.scale;

            const offset = bitmapMeasurement.offsetY * scale;

            bounds[0] = 0;
            bounds[1] = offset;
            bounds[2] = bitmapMeasurement.width * scale;
            bounds[3] = (bitmapMeasurement.height * scale) + offset;
        }
        else
        {
            const canvasMeasurement = CanvasTextMetrics.measureText(this.text, this._style);

            bounds[0] = 0;
            bounds[1] = 0;
            bounds[2] = canvasMeasurement.width;
            bounds[3] = canvasMeasurement.height;
        }
    }

    addBounds(bounds: Bounds)
    {
        const _bounds = this.bounds;

        bounds.addFrame(
            _bounds[0],
            _bounds[1],
            _bounds[2],
            _bounds[3],
        );
    }

    onChange()
    {
        this.boundsDirty = true;
        this.onRenderableUpdate();
    }

    getKey(): string
    {
        // TODO add a dirty flag...
        return `${this.text}:${this._style.styleKey}`;
    }

    containsPoint(point: PointData)
    {
        const position = this.data.worldTransform.applyInverse(point, Point.shared);

        const width = this.bounds[2];
        const height = this.bounds[3];
        const x1 = -width * this.anchor.x;
        let y1 = 0;

        if (position.x >= x1 && position.x < x1 + width)
        {
            y1 = -height * this.anchor.y;

            if (position.y >= y1 && position.y < y1 + height) return true;
        }

        return false;
    }

    detectRenderType(style: TextStyle): 'canvas' | 'html' | 'bitmap'
    {
        return Cache.has(style.fontFamily as string) ? 'bitmap' : 'canvas';
    }
}
