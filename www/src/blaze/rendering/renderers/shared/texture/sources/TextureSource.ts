import { Runner } from '../../runner/Runner.js';
import { TextureStyle } from '../TextureStyle.js';

import type { BindResource } from '../../../gpu/shader/BindResource.js';
import type { TEXTURE_DIMENSIONS, TEXTURE_FORMATS, TEXTURE_VIEW_DIMENSIONS } from '../const.js';
import type { BindableTexture } from '../Texture.js';
import type { TextureStyleOptions } from '../TextureStyle.js';

let UID = 0;
let RESOURCE_ID = 0;

export interface TextureSourceOptions<T = any>
{
    resource?: T;

    width?: number;
    height?: number;
    resolution?: number;

    format?: TEXTURE_FORMATS;
    sampleCount?: number;
    antialias?: boolean;

    dimensions?: TEXTURE_DIMENSIONS;
    view?: TEXTURE_VIEW_DIMENSIONS;

    mipLevelCount?: number;
    autoGenerateMipmaps?: boolean;

    style?: TextureStyleOptions | TextureStyle;
}

export class TextureSource<T = any> implements BindableTexture, BindResource
{
    uid = UID++;

    resourceType = 'textureSource';
    resourceId = RESOURCE_ID++;
    onResourceChange = new Runner('onResourceChange');

    type = 'unknown';

    // dimensions
    resolution = 1;
    pixelWidth = 1;
    pixelHeight = 1;

    width = 1;
    height = 1;

    resource: T;

    // sample count for multisample textures
    // generally this is used only used internally by pixi!
    sampleCount = 1;

    // antialias = false;

    // mip stuff..
    mipLevelCount = 1; // overridden if autoGenerateMipmaps is true
    autoGenerateMipmaps = false;

    format: TEXTURE_FORMATS = 'rgba8unorm-srgb';
    viewDimensions: TEXTURE_VIEW_DIMENSIONS = '2d';
    dimension: TEXTURE_DIMENSIONS = '2d';

    readonly style: TextureStyle;

    onSourceUpdate = new Runner('onSourceUpdate');
    onSourceDestroy = new Runner('onSourceDestroy');
    onSourceResize = new Runner('onSourceResize');

    styleSourceKey: number;

    // properties used when rendering to this texture..
    antialias = false;
    depthStencil = true;

    constructor(options: TextureSourceOptions<T> = {})
    {
        this.resource = options.resource;

        this.resolution = options.resolution ?? 1;

        if (options.width)
        {
            this.pixelWidth = options.width * this.resolution;
        }
        else
        {
            this.pixelWidth = (options.resource as any)?.width ?? 1;
        }

        if (options.height)
        {
            this.pixelHeight = options.height * this.resolution;
        }
        else
        {
            this.pixelHeight = (options.resource as any)?.height ?? 1;
        }

        //        console.log('this.pixelWidth', options, this.pixelWidth);

        this.width = this.pixelWidth / this.resolution;
        this.height = this.pixelHeight / this.resolution;

        this.format = options.format ?? 'bgra8unorm';
        this.viewDimensions = options.view ?? '2d';
        this.dimension = options.dimensions ?? '2d';
        this.mipLevelCount = options.mipLevelCount ?? 1;
        this.autoGenerateMipmaps = options.autoGenerateMipmaps ?? false;
        this.sampleCount = options.sampleCount ?? 1;
        this.antialias = options.antialias ?? false;

        const style = options.style ?? {};

        this.style = style instanceof TextureStyle ? style : new TextureStyle(style);
        this.style.onStyleUpdate.add(this);
        this.styleSourceKey = (this.style.resourceId << 24) + this.uid;
    }

    get source(): TextureSource
    {
        return this;
    }

    update()
    {
        this.onSourceUpdate.emit(this);
    }

    onStyleUpdate()
    {
        this.styleSourceKey = (this.style.resourceId << 24) + this.uid;
    }

    destroy()
    {
        this.onSourceDestroy.emit(this);
        this.resource = null;

        // TODO clear all runners..
    }

    setResolution(resolution: number)
    {
        if (this.resolution === resolution) return;

        this.resolution = resolution;

        this.width = this.pixelWidth / resolution;
        this.height = this.pixelHeight / resolution;
    }

    resize(width?: number, height?: number, resolution?: number)
    {
        resolution = resolution || this.resolution;
        width = width || this.width;
        height = height || this.height;

        // make sure we work with rounded pixels
        const newPixelWidth = Math.round(width * resolution);
        const newPixelHeight = Math.round(height * resolution);

        this.width = newPixelWidth / resolution;
        this.height = newPixelHeight / resolution;

        this.resolution = resolution;

        if (this.pixelWidth === newPixelWidth && this.pixelHeight === newPixelHeight)
        {
            return;
        }

        this.pixelWidth = newPixelWidth;
        this.pixelHeight = newPixelHeight;

        this.onSourceResize.emit(this);

        this.resourceId++;
        this.onResourceChange.emit(this);
    }
}
