import { Shader } from '../renderers/shared/shader/Shader.js';
import { BLEND_MODES } from '../renderers/shared/state/const.js';
import { State } from '../renderers/shared/state/State.js';

import type { RenderSurface } from '../renderers/gpu/renderTarget/GpuRenderTargetSystem.js';
import type { ShaderWithResourcesDescriptor } from '../renderers/shared/shader/Shader.js';
import type { Texture } from '../renderers/shared/texture/Texture.js';
import type { FilterPipe } from './shared/FilterPipe.js';

export interface FilterOptions extends ShaderWithResourcesDescriptor
{
    blendMode?: BLEND_MODES;
    resolution?: number;
    padding?: number;
    antialias?: FilterAntiAlias | boolean;
    blendRequired?: boolean;
}

export enum FilterAntiAlias
    {
    // the filter will force antialiasing for the effect
    ON,
    // the filter will prefer no antialiasing when applying its effect
    OFF,
    // inherit means it will match the render targets antialiasing
    INHERIT
}

export class Filter extends Shader
{
    // override to set styles globally
    static readonly DEFAULT: FilterOptions = {
        blendMode: BLEND_MODES.NORMAL,
        resolution: 1,
        padding: 0,
        antialias: FilterAntiAlias.INHERIT,
        blendRequired: false,
    };

    /**
     * The padding of the filter. Some filters require extra space to breath such as a blur.
     * Increasing this will add extra width and height to the bounds of the object that the
     * filter is applied to.
     */
    public padding: number;

    /** should the filter use antialiasing? */
    public antialias: FilterAntiAlias;

    /** If enabled is true the filter is applied, if false it will not. */
    public enabled = true;

    state = State.for2d();

    public resolution: number;
    public blendRequired: boolean;

    public shader: Shader;

    // bindGroup?: BindGroup;
    // uniformGroup: UniformGroup<any>;
    // uniforms: Record<string, any>;

    constructor(options: FilterOptions)
    {
        options = { ...Filter.DEFAULT, ...options };

        super({
            gpuProgram: options.gpuProgram,
            glProgram: options.glProgram,
            resources: options.resources,
        });

        this.padding = options.padding;

        // check if is boolean
        if (typeof options.antialias === 'boolean')
        {
            this.antialias = options.antialias ? FilterAntiAlias.ON : FilterAntiAlias.OFF;
        }
        else
        {
            this.antialias = options.antialias ?? FilterAntiAlias.INHERIT;
        }

        this.resolution = options.resolution;
        this.blendRequired = options.blendRequired;
    }

    public apply(
        filterManager: FilterPipe,
        input: Texture,
        output: RenderSurface,
        clearMode: boolean
    ): void
    {
        filterManager.applyFilter(this, input, output, clearMode);
    }

    /**
     * Sets the blend mode of the filter.
     * @default PIXI.BLEND_MODES.NORMAL
     */
    get blendMode(): BLEND_MODES
    {
        return this.state.blendMode;
    }

    set blendMode(value: BLEND_MODES)
    {
        this.state.blendMode = value;
    }
}
