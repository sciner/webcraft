import { ExtensionType } from '../../../../extensions/Extensions.js';
import { settings } from '../../../../settings/settings.js';
import { getCanvasTexture } from '../texture/utils/getCanvasTexture.js';

import type { ExtensionMetadata } from '../../../../extensions/Extensions.js';
import type { ICanvas } from '../../../../settings/adapter/ICanvas.js';
import type { Renderer } from '../../types.js';
import type { ISystem } from '../system/ISystem.js';
import type { CanvasSourceOptions } from '../texture/sources/CanvasSource.js';
import type { Texture } from '../texture/Texture.js';

/**
 * Options passed to the ViewSystem
 * @memberof PIXI
 */
export interface ViewSystemOptions
{
    /**
     * The width of the screen.
     * @memberof PIXI.WebGLRendererOptions
     */
    width?: number;
    /**
     * The height of the screen.
     * @memberof PIXI.WebGLRendererOptions
     */
    height?: number;
    /**
     * The canvas to use as a view, optional.
     * @memberof PIXI.WebGLRendererOptions
     */
    element?: ICanvas;
    /**
     * Resizes renderer view in CSS pixels to allow for resolutions other than 1.
     * @memberof PIXI.WebGLRendererOptions
     */
    autoDensity?: boolean;
    /**
     * The resolution / device pixel ratio of the renderer.
     * @memberof PIXI.WebGLRendererOptions
     */
    resolution?: number;
    /**
     * **WebGL Only.** Whether to enable anti-aliasing. This may affect performance.
     * @memberof PIXI.WebGLRendererOptions
     */
    antialias?: boolean;
    /**
     * TODO: multiView
     * @memberof PIXI.WebGLRendererOptions
     */
    multiView?: boolean;
}

/**
 * The view system manages the main canvas that is attached to the DOM.
 * This main role is to deal with how the holding the view reference and dealing with how it is resized.
 * @memberof PIXI
 */
export class ViewSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererSystem,
            ExtensionType.WebGPURendererSystem,
            ExtensionType.CanvasRendererSystem,
        ],
        name: 'view',
        priority: 0,
    };

    /** @ignore */
    static defaultOptions: ViewSystemOptions = {
        /**
         * {@link PIXI.WebGLRendererOptions.width}
         * @default 800
         * @memberof PIXI.settings.GL_RENDER_OPTIONS
         */
        width: 800,
        /**
         * {@link PIXI.WebGLRendererOptions.height}
         * @default 600
         * @memberof PIXI.settings.GL_RENDER_OPTIONS
         */
        height: 600,
        /**
         * {@link PIXI.WebGLRendererOptions.resolution}
         * @type {number}
         * @default PIXI.settings.RESOLUTION
         * @memberof PIXI.settings.GL_RENDER_OPTIONS
         */
        resolution: settings.RESOLUTION,
        /**
         * {@link PIXI.WebGLRendererOptions.autoDensity}
         * @default false
         * @memberof PIXI.settings.GL_RENDER_OPTIONS
         */
        autoDensity: false,
        /**
         * {@link PIXI.WebGLRendererOptions.antialias}
         * @default false
         * @memberof PIXI.settings.GL_RENDER_OPTIONS
         */
        antialias: false,
    };

    readonly renderer: Renderer;

    public multiView: boolean;

    /** The canvas element that everything is drawn to. */
    public element: ICanvas;

    public texture: Texture;

    /**
     * Whether CSS dimensions of canvas view should be resized to screen dimensions automatically.
     * @member {boolean}
     */
    public autoDensity: boolean;

    public antialias: boolean;

    constructor(renderer: Renderer)
    {
        this.renderer = renderer;
    }

    get resolution(): number
    {
        return this.texture.source.resolution;
    }

    /**
     * initiates the view system
     * @param options - the options for the view
     */
    init(options: ViewSystemOptions): void
    {
        this.element = options.element || settings.ADAPTER.createCanvas();

        this.antialias = !!options.antialias;

        this.texture = getCanvasTexture(this.element, options as CanvasSourceOptions);

        this.multiView = !!options.multiView;
    }

    /**
     * Resizes the screen and canvas to the specified dimensions.
     * @param desiredScreenWidth - The new width of the screen.
     * @param desiredScreenHeight - The new height of the screen.
     * @param resolution
     */
    resizeView(desiredScreenWidth: number, desiredScreenHeight: number, resolution: number): void
    {
        this.texture.source.resize(desiredScreenWidth, desiredScreenHeight, resolution);
    }

    /**
     * Destroys this System and optionally removes the canvas from the dom.
     * @param {boolean} [removeView=false] - Whether to remove the canvas from the DOM.
     */
    destroy(removeView: boolean): void
    {
        // ka boom!
        if (removeView && this.element.parentNode)
        {
            this.element.parentNode.removeChild(this.element);
        }

        // this._renderer = null;
        this.element = null;
    }
}
