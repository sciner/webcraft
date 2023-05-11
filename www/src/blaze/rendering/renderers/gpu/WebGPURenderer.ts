import { extensions, ExtensionType } from '../../../extensions/Extensions.js';
import { SharedDefaultRendererOptions, SharedRendererExtensions } from '../shared/system/SharedSystems.js';
import { SystemManager } from '../shared/system/SystemManager.js';
import { getCanvasTexture } from '../shared/texture/utils/getCanvasTexture.js';
import { WebGPUSystemsExtensions } from './WebGPUSystems.js';

import type { ExtensionFormat } from '../../../extensions/Extensions.js';
import type { ICanvas } from '../../../settings/adapter/ICanvas.js';
import type { Container } from '../../scene/Container.js';
import type { ISystemConstructor } from '../shared/system/ISystem.js';
import type { SharedRendererOptions } from '../shared/system/SharedSystems.js';
import type { GPU } from './GpuDeviceSystem.js';
import type { RenderSurface } from './renderTarget/GpuRenderTargetSystem.js';
import type { GPURenderPipes, GPURenderSystems } from './WebGPUSystems.js';

/**
 * Renderer options supplied to constructor.
 * @memberof PIXI
 * @see PIXI.settings.GL_RENDER_OPTIONS
 */
export type WebGPURendererOptions = PixiMixins.WebGPURendererOptions & SharedRendererOptions;

export interface WebGPURenderer extends SystemManager<WebGPURenderer>, GPURenderSystems
{
    readonly renderPipes: GPURenderPipes
}

export class WebGPURenderer extends SystemManager<WebGPURenderer> implements GPURenderSystems
{
    type = 'webgpu';

    public readonly renderPipes = {} as GPURenderPipes;

    gpu: GPU;

    globalUniformBindGroup: GPUBindGroup;

    options: WebGPURendererOptions;

    private _lastObjectRendered: Container;
    // TODO: not implemented
    // private _renderingToScreen = true;

    constructor()
    {
        super();

        const systemConfig = {
            runners: ['init', 'destroy', 'contextChange', 'reset', 'update', 'postrender', 'prerender', 'resize'],
            systems: WebGPURenderer.__systems,
            pipes: WebGPURenderer.__pipes,
        };

        const pipeConfig = {
            ...WebGPURenderer.__pipesAdaptors
        };

        Object.keys(systemConfig.pipes).forEach((key) =>
        {
            const Pipe = systemConfig.pipes[key];
            const Adaptor = pipeConfig[key]?.adaptor;

            if (Adaptor)
            {
                this.renderPipes[key] = new Pipe(this, new Adaptor());
            }
            else
            {
                this.renderPipes[key] = new Pipe(this);
            }
        });

        this.setup(systemConfig);
    }

    /**
     * Resizes the WebGL view to the specified width and height.
     * @param desiredScreenWidth - The desired width of the screen.
     * @param desiredScreenHeight - The desired height of the screen.
     * @param resolution
     */
    resize(desiredScreenWidth: number, desiredScreenHeight: number, resolution?: number): void
    {
        this.view.resizeView(desiredScreenWidth, desiredScreenHeight, resolution);
    }

    async init(options: WebGPURendererOptions)
    {
        // Add the default render options
        options = Object.assign({}, {
            ...SharedDefaultRendererOptions
        }, options);
        this.options = options;
        this.startup.run(options);

        await this.device.init();
    }

    render(container: Container, target?: RenderSurface)
    {
        if (target instanceof HTMLCanvasElement)
        {
            target = getCanvasTexture(target as ICanvas);
        }

        if (!target)
        {
            target = this.view.texture;
        }

        this.runners.prerender.emit();

        this.renderTarget.start(target, true, this.background.colorRgba);

        this.container.render(container);

        this._lastObjectRendered = container;

        this.encoder.finish();
    }

    // TODO: resolution is not dynamic
    /** The resolution / device pixel ratio of the renderer. */
    get resolution(): number
    {
        return this.view.resolution;
    }

    get width(): number
    {
        return this.view.texture.frameWidth;
    }

    get height(): number
    {
        return this.view.texture.frameHeight;
    }

    // set resolution(value: number)
    // {
    //     this.view.resolution = value;
    //     this.runners.resolutionChange.emit(value);
    // }

    // NOTE: this was `view` in v7
    /** The canvas element that everything is drawn to.*/
    get canvas(): ICanvas
    {
        return this.view.element;
    }

    // TODO: currently doesn't exist
    // /**
    //  * Measurements of the screen. (0, 0, screenWidth, screenHeight).
    //  *
    //  * Its safe to use as filterArea or hitArea for the whole stage.
    //  * @member {PIXI.Rectangle}
    //  */
    // get screen(): Rectangle
    // {
    //     return this.view.screen;
    // }

    /**
     * the last object rendered by the renderer. Useful for other plugins like interaction managers
     * @readonly
     */
    get lastObjectRendered(): Container
    {
        return this._lastObjectRendered;
    }

    /**
     * Flag if we are rendering to the screen vs renderTexture
     * @readonly
     * @default true
     */
    get renderingToScreen(): boolean
    {
        return true; // TODO: this._renderingToScreen;
    }

    /** When logging Pixi to the console, this is the name we will show */
    get rendererLogId(): string
    {
        return `WebGPU`;
    }
    /**
     * The collection of installed systems.
     * @private
     */
    static readonly __systems: {name: string, value: ISystemConstructor}[] = [];
    /**
     * The collection of installed pipes.
     * @private
     */
    static readonly __pipes: Record<string, ISystemConstructor> = {};
    /**
     * The collection of installed pipe adaptors.
     * @private
     */
    static readonly __pipesAdaptors: Record<string, any> = {};
}

extensions.handleByNamedList(ExtensionType.WebGPURendererSystem, WebGPURenderer.__systems);
extensions.handleByMap(ExtensionType.WebGPURendererPipes, WebGPURenderer.__pipes);
extensions.handle(ExtensionType.WebGPURendererPipesAdaptor, (extension: ExtensionFormat) =>
{
    WebGPURenderer.__pipesAdaptors[extension.name] = { adaptor: extension.ref };
}, (extension: ExtensionFormat) =>
{
    delete WebGPURenderer.__pipesAdaptors[extension.name];
});
extensions.add(
    ...SharedRendererExtensions,
    ...WebGPUSystemsExtensions
);
