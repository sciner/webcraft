import { Runner } from '../runner/Runner';
import { TextureSource } from './sources/TextureSource';
import { TextureLayout } from './TextureLayout';
import { TextureMatrix } from './TextureMatrix';
import { TextureStyle } from './TextureStyle';

import type { TextureLayoutOptions } from './TextureLayout';
import type { TextureStyleOptions } from './TextureStyle';

let UID = 0;

export interface TextureOptions
{
    source?: TextureSource;
    style?: TextureStyle | TextureStyleOptions
    layout?: TextureLayout | TextureLayoutOptions
    label?: string;
}

export interface BindableTexture
{
    source: TextureSource;
    style: TextureStyle;
    styleSourceKey: number;
}

export class Texture implements BindableTexture
{
    static from(id: string): Texture
    {
        return Cache.get(id);
    }

    label?: string;
    id = UID++;
    styleSourceKey = 0;

    _source: TextureSource;
    _style: TextureStyle;
    _layout: TextureLayout;
    _textureMatrix: TextureMatrix;

    onTextureUpdate: Runner = new Runner('onTextureUpdate');

    constructor({ source, style, layout, label }: TextureOptions)
    {
        this.label = label;
        this.source = source?.source ?? new TextureSource();
        this.layout = layout instanceof TextureLayout ? layout : new TextureLayout(layout);

        if (style)
        {
            this._style = style instanceof TextureStyle ? style : new TextureStyle(style);
        }

        this.styleSourceKey = (this.style.resourceId << 24) + this._source.uid;
    }

    set source(value: TextureSource)
    {
        if (this._source)
        {
            this._source.onSourceUpdate.remove(this);
            this._source.onSourceResize.remove(this);
        }

        this._source = value;

        value.onSourceUpdate.add(this);
        value.onSourceResize.add(this);

        this.styleSourceKey = (this.style.resourceId << 24) + this._source.uid;
        this.onTextureUpdate.emit(this);
    }

    get source(): TextureSource
    {
        return this._source;
    }

    get style(): TextureStyle
    {
        return this._style || this.source.style;
    }

    set style(value: TextureStyle)
    {
        this._style?.onStyleUpdate.remove(this);
        this._style = value;
        this._style?.onStyleUpdate.add(this);
    }

    get layout(): TextureLayout
    {
        return this._layout;
    }

    set layout(value: TextureLayout)
    {
        this._layout?.onLayoutUpdate.remove(this);

        this._layout = value;

        value.onLayoutUpdate.add(this);

        this.onTextureUpdate.emit(this);
    }

    get textureMatrix()
    {
        if (!this._textureMatrix)
        {
            this._textureMatrix = new TextureMatrix(this);
        }

        return this._textureMatrix;
    }

    set frameWidth(value: number)
    {
        this._layout.frame.width = value / this._source.width;
    }

    get frameWidth(): number
    {
        return (this._source.pixelWidth / this._source.resolution) * this._layout.frame.width;
    }

    set frameHeight(value: number)
    {
        this._layout.frame.height = value / this._source.height;
    }

    get frameHeight(): number
    {
        return (this._source.pixelHeight / this._source.resolution) * this._layout.frame.height;
    }

    set frameX(value: number)
    {
        if (value === 0)
        {
            this._layout.frame.x = 0;

            return;
        }

        this._layout.frame.x = (this._source.width) / value;
    }

    get frameX(): number
    {
        return (this._source.width) * this._layout.frame.x;
    }

    set frameY(value: number)
    {
        if (value === 0)
        {
            this._layout.frame.y = 0;

            return;
        }

        this._layout.frame.y = (this._source.height) / value;
    }

    get frameY(): number
    {
        return (this._source.height) * this._layout.frame.y;
    }

    get width(): number
    {
        return (this._source.width) * this._layout.orig.width;
    }

    get height(): number
    {
        return (this._source.height) * this._layout.orig.height;
    }

    destroy(destroySource = false)
    {
        // eslint-disable-next-line no-console
        console.log('KA BOoM!', destroySource);
    }

    onSourceUpdate()
    {
        this.styleSourceKey = (this.style.resourceId << 24) + this._source.uid;
        this.onTextureUpdate.emit(this);
    }

    onSourceResize()
    {
        this.onTextureUpdate.emit(this);
    }

    onLayoutUpdate()
    {
        this.onTextureUpdate.emit(this);
    }

    onStyleUpdate()
    {
        this.styleSourceKey = (this.style.resourceId << 24) + this._source.uid;
        this.onTextureUpdate.emit(this);
    }

    static EMPTY: Texture;
    static WHITE: Texture;
}

Texture.EMPTY = new Texture({

});
