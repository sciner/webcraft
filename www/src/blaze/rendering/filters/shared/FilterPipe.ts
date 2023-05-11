import { ExtensionType } from '../../../extensions/Extensions.js';
import { Matrix } from '../../../maths/Matrix.js';
import { BindGroup } from '../../renderers/gpu/shader/BindGroup';
import { Geometry } from '../../renderers/shared/geometry/Geometry.js';
import { UniformGroup } from '../../renderers/shared/shader/UniformGroup';
import { Texture } from '../../renderers/shared/texture/Texture';
import { TexturePool } from '../../renderers/shared/texture/TexturePool.js';
import { Bounds } from '../../scene/bounds/Bounds.js';
import { getGlobalBounds } from '../../scene/bounds/getGlobalBounds.js';
import { getGlobalRenderableBounds } from '../../scene/bounds/getRenderableBounds.js';
import { FilterAntiAlias } from '../Filter.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { RenderSurface } from '../../renderers/gpu/renderTarget/GpuRenderTargetSystem.js';
import type { Instruction } from '../../renderers/shared/instructions/Instruction.js';
import type { InstructionSet } from '../../renderers/shared/instructions/InstructionSet.js';
import type { InstructionGenerator, InstructionRunner } from '../../renderers/shared/instructions/RenderPipe.js';
import type { Renderable } from '../../renderers/shared/Renderable.js';
import type { RenderTarget } from '../../renderers/shared/renderTarget/RenderTarget.js';
import type { Renderer } from '../../renderers/types.js';
import type { Container } from '../../scene/Container.js';
import type { Sprite } from '../../sprite/shared/Sprite.js';
import type { Filter } from '../Filter.js';
import type { FilterEffect } from '../FilterEffect.js';
import type { GPURenderPipes } from '../../renderers/gpu/WebGPUSystems.js';

type FilterAction = 'pushFilter' | 'popFilter';

const tempMatrix = new Matrix();

export interface FilterAdaptor
{
    copyBackTexture(
        renderer: Renderer,
        sourceRenderSurfaceTexture: RenderTarget,
        destinationTexture: Texture,
        origin: {x: number, y: number},
        size: {width: number, height: number},
    ): Texture
}

//
const quadGeometry = new Geometry({
    attributes: {
        aPosition: {
            buffer: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
            shaderLocation: 0,
            format: 'float32x2',
            stride: 2 * 4,
            offset: 0,
        },
    },
    indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
});

/**
 * The filter pipeline is responsible for applying filters scene items!
 *
 * KNOWN BUGS:
 * 1. Global bounds calculation is incorrect if it is used when flip flopping filters. The maths can be found below
 * eg: filters [noiseFilter, blurFilter] noiseFilter will calculate the global bounds incorrectly.
 *
 * 2. RenderGroups do not work with filters. This is because the renderGroup matrix is not currently taken into account.
 *
 * Implementation notes:
 * 1. Gotcha - nesting filters that require blending will not work correctly. This creates a chicken and egg problem
 * the complexity and performance required to do this is not worth it i feel.. but lets see if others agree!
 *
 * 2. Filters are designed to be changed on the fly, this is means that changing filter information each frame will
 * not trigger an instruction rebuild. If you are constantly turning a filter on and off.. its therefore better to set
 * enabled to true or false on the filter. Or setting an empty array.
 *
 * 3. Need to look at perhaps aliasing when flip flopping filters. Really we should only need to antialias the FIRST
 * Texture we render too. The rest can be non aliased. This might help performance.
 * Currently we flip flop with an antialiased texture if antialiasing is enabled on the filter.
 */
export interface FilterInstruction extends Instruction
{
    type: 'filter',
    action: FilterAction,
    container?: Container,
    renderables?: Renderable[],
    filterEffect: FilterEffect,
}

export interface FilterData
{
    skip: boolean;
    inputTexture: Texture
    bounds: Bounds,
    blendRequired: boolean,
    container: Container,
    filterEffect: FilterEffect,
    previousGlobalBindGroup: BindGroup,
    previousRenderSurface: RenderTarget,
}

// eslint-disable-next-line max-len
export class FilterPipe implements InstructionRunner<FilterInstruction>, InstructionGenerator
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererPipes,
            ExtensionType.WebGPURendererPipes,
            ExtensionType.CanvasRendererPipes,
        ],
        name: 'filter',
    };

    instructionSet: InstructionSet;

    filterStackIndex = 0;
    filterStack: FilterData[] = [];

    renderer: Renderer;

    texturePool: TexturePool = new TexturePool();

    filterGlobalUniforms = new UniformGroup({
        inputSize: { value: new Float32Array(4), type: 'vec4<f32>' },
        inputPixel: { value: new Float32Array(4), type: 'vec4<f32>' },
        inputClamp: { value: new Float32Array(4), type: 'vec4<f32>' },
        outputFrame: { value: new Float32Array(4), type: 'vec4<f32>' },
        backgroundFrame: { value: new Float32Array(4), type: 'vec4<f32>' },
        globalFrame: { value: new Float32Array(4), type: 'vec4<f32>' },
    });

    globalFilterBindGroup: BindGroup = new BindGroup({});
    activeFilterData: FilterData;

    adaptor: FilterAdaptor;

    constructor(renderer: Renderer, adaptor: FilterAdaptor)
    {
        this.renderer = renderer;
        this.adaptor = adaptor;
    }

    bind(instructionSet: InstructionSet)
    {
        this.instructionSet = instructionSet;
    }

    push(filterEffect: FilterEffect, container: Container): void
    {
        const instructionSet = this.instructionSet;

        const renderPipes = this.renderer.renderPipes;

        renderPipes.batch.break();

        instructionSet.addInstruction({
            type: 'filter',
            canBundle: false,
            action: 'pushFilter',
            container,
            filterEffect,
        } as FilterInstruction);
    }

    pop(): void
    {
        const instructionSet = this.instructionSet;

        this.renderer.renderPipes.batch.break();

        instructionSet.addInstruction({
            type: 'filter',
            action: 'popFilter',
            canBundle: false,
        });
    }

    execute(instruction: FilterInstruction)
    {
        if (instruction.action === 'pushFilter')
        {
            this.pushFilterAction(instruction);
        }
        else if (instruction.action === 'popFilter')
        {
            this.popFilterAction();
        }
    }

    pushFilterAction(instruction: FilterInstruction)
    {
        const renderer = this.renderer;

        const filters = instruction.filterEffect.filters;

        if (!this.filterStack[this.filterStackIndex])
        {
            this.filterStack[this.filterStackIndex] = this.getFilterData();
        }

        // get a filter data from the stack. They can be reused multiple times each frame,
        // so we don't need to worry about overwriting them in a single pass.
        const filterData = this.filterStack[this.filterStackIndex];

        this.filterStackIndex++;

        const bounds: Bounds = filterData.bounds;

        if (instruction.renderables)
        {
            getGlobalRenderableBounds(instruction.renderables, bounds);
        }
        else
        {
            getGlobalBounds(instruction.container, true, bounds);
        }
        // get GLOBAL bounds of the item we are going to apply the filter to

        // if there are no filters, we skip the pass
        if (filters.length === 0)
        {
            filterData.skip = true;

            return;
        }

        // next we get the settings for the filter
        // we need to find the LOWEST resolution for the filter list
        let resolution = renderer.renderTarget.rootRenderTarget.colorTexture.source.resolution;

        // Padding is additive to add padding to our padding
        let padding = 0;
        // if this is true for any filter, it should be true
        let antialias = renderer.renderTarget.rootRenderTarget.colorTexture.source.antialias;
        // true if any filter requires the previous render target
        let blendRequired = false;
        // true if any filter in the list is enabled
        let enabled = false;

        for (let i = 0; i < filters.length; i++)
        {
            const filter = filters[i];

            resolution = Math.min(resolution, filter.resolution);
            padding += filter.padding;

            if (filter.antialias !== FilterAntiAlias.INHERIT)
            {
                if (filter.antialias === FilterAntiAlias.ON)
                {
                    antialias = true;
                }
                else
                {
                    antialias = false;
                }
            }

            enabled = filter.enabled || enabled;
            blendRequired = blendRequired || filter.blendRequired;
        }

        // if no filters are enabled lets skip!
        if (!enabled)
        {
            filterData.skip = true;

            return;
        }

        // her we constrain the bounds to the viewport we will render too
        // need to factor in resolutions also..
        bounds.scale(resolution)
            .fit(renderer.renderTarget.rootRenderTarget.viewport)
            .scale(1 / resolution)
            .pad(padding)
            .ceil();

        // skip if the bounds are negative or zero as this means they are
        // not visible on the screen
        if (!bounds.isPositive)
        {
            filterData.skip = true;

            return;
        }

        // set all the filter data
        filterData.skip = false;

        filterData.bounds = bounds;
        filterData.blendRequired = blendRequired;
        filterData.container = instruction.container;
        filterData.filterEffect = instruction.filterEffect;

        filterData.previousRenderSurface = renderer.renderTarget.renderTarget;
        filterData.previousGlobalBindGroup = renderer.globalUniforms.bindGroup;

        filterData.inputTexture = renderer.texturePool.bind(
            bounds,
            resolution,
            antialias
        );
    }

    popFilterAction()
    {
        const renderer = this.renderer;

        this.filterStackIndex--;
        const filterData = this.filterStack[this.filterStackIndex];

        // if we are skipping this filter then we just do nothing :D
        if (filterData.skip)
        {
            return;
        }

        this.activeFilterData = filterData;

        const inputTexture = filterData.inputTexture;

        const bounds = filterData.bounds;

        let backTexture = Texture.EMPTY;

        if (filterData.blendRequired)
        {
            // this actually forces the current commandQueue to render everything so far.
            // if we don't do this, we won't be able to copy pixels for the background

            renderer.encoder.finishRenderPass();

            backTexture = this.getBackTexture(filterData.previousRenderSurface, bounds);
        }

        // update all the global uniforms used by each filter
        this.updateGlobalFilterUniforms(bounds, inputTexture, backTexture);

        const filters = filterData.filterEffect.filters;

        this.filterGlobalUniforms.update();

        // get a BufferResource from the uniformBatch.
        // this will batch the shader uniform data and give us a buffer resource we can
        // set on our globalUniform Bind Group
        // eslint-disable-next-line max-len

        let globalUniforms = this.filterGlobalUniforms;

        if ((renderer.renderPipes as GPURenderPipes).uniformBatch)
        {
            globalUniforms = (renderer.renderPipes as any).uniformBatch
                .getUniformBufferResource(this.filterGlobalUniforms, filters[0].gpuProgram);
        }

        // update the resources on the bind group...
        this.globalFilterBindGroup.setResource(globalUniforms, 0);
        this.globalFilterBindGroup.setResource(inputTexture.style, 2);
        this.globalFilterBindGroup.setResource(backTexture.source, 3);

        // this will restore the previous bind group..
        renderer.globalUniforms.bindGroup = filterData.previousGlobalBindGroup;

        if (filters.length === 1)
        {
            // render a single filter...
            // this.applyFilter(filters[0], inputTexture, filterData.previousRenderSurface, false);
            filters[0].apply(this, inputTexture, filterData.previousRenderSurface, false);

            // logDebugTexture(inputTexture, this.renderer);
            // return the texture to the pool so we can reuse the next frame
            renderer.texturePool.returnTexture(inputTexture);
        }
        else
        {
            let flip = filterData.inputTexture;

            // lets offset the bounds as we are rendering to another texture.. not the root of
            // the filter.
            const boundsTransform = tempMatrix;

            boundsTransform.tx = -bounds.minX;
            boundsTransform.ty = -bounds.minY;

            // we need this render target to access the projectionMatrix
            const flipRenderTarget = renderer.renderTarget.getRenderTarget(flip);

            renderer.globalUniforms.bind(flipRenderTarget.projectionMatrix, boundsTransform, 1);

            // get another texture that we will render the next filter too
            let flop = renderer.texturePool.getTexture(
                bounds,
                flip.source.resolution,
                false
            );

            let i = 0;

            // loop and apply the filters, omitting the last one as we will render that to the final target
            for (i = 0; i < filters.length - 1; ++i)
            {
                const filter = filters[i];

                filter.apply(this, flip, flop, true);
                const t = flip;

                flip = flop;
                flop = t;
            }

            // remove the global uniforms we added

            renderer.globalUniforms.bindGroup = filterData.previousGlobalBindGroup;

            // BUG - global frame is only correct for the last filter in the stack
            filters[i].apply(this, flip, filterData.previousRenderSurface, false);

            // return those textures for later!
            renderer.texturePool.returnTexture(flip);
            renderer.texturePool.returnTexture(flop);
        }

        // if we made a background texture, lets return that also
        if (filterData.blendRequired)
        {
            renderer.texturePool.returnTexture(backTexture);
        }
    }

    updateGlobalFilterUniforms(bounds: Bounds, texture: Texture, backTexture: Texture)
    {
        const bx = bounds.minX;
        const by = bounds.minY;

        const uniforms = this.filterGlobalUniforms.uniforms;

        const outputFrame = uniforms.outputFrame;
        const inputSize = uniforms.inputSize;
        const inputPixel = uniforms.inputPixel;
        const inputClamp = uniforms.inputClamp;
        const backgroundFrame = uniforms.backgroundFrame;
        const globalFrame = uniforms.globalFrame;

        outputFrame[0] = bx;
        outputFrame[1] = by;
        outputFrame[2] = texture.frameWidth;
        outputFrame[3] = texture.frameHeight;

        inputSize[0] = texture.source.width;
        inputSize[1] = texture.source.height;
        inputSize[2] = 1 / inputSize[0];
        inputSize[3] = 1 / inputSize[1];

        inputPixel[0] = texture.source.pixelWidth;
        inputPixel[1] = texture.source.pixelHeight;
        inputPixel[2] = 1.0 / inputPixel[0];
        inputPixel[3] = 1.0 / inputPixel[1];

        inputClamp[0] = 0.5 * inputPixel[2];
        inputClamp[1] = 0.5 * inputPixel[3];
        inputClamp[2] = (texture.frameWidth * inputSize[2]) - (0.5 * inputPixel[2]);
        inputClamp[3] = (texture.frameHeight * inputSize[3]) - (0.5 * inputPixel[3]);

        backgroundFrame[0] = 0;
        backgroundFrame[1] = 0;
        backgroundFrame[2] = backTexture.layout.frame.width;
        backgroundFrame[3] = backTexture.layout.frame.height;

        let obX = 0;
        let obY = 0;
        let resolution = this.renderer.renderTarget.rootRenderTarget.colorTexture.source.resolution;

        const copyToOut = true;

        if (!copyToOut)
        {
            obX = bounds.minX;
            obY = bounds.minY;
        }

        if (this.filterStackIndex > 0)
        {
            if (copyToOut)
            {
                obX = this.filterStack[this.filterStackIndex - 1].bounds.minX;
                obY = this.filterStack[this.filterStackIndex - 1].bounds.minY;
            }

            resolution = this.filterStack[this.filterStackIndex - 1].inputTexture.source.resolution;
        }

        globalFrame[0] = obX * resolution;
        globalFrame[1] = obY * resolution;

        const rootTexture = this.renderer.renderTarget.rootRenderTarget.colorTexture;

        globalFrame[2] = rootTexture.source.width * resolution;
        globalFrame[3] = rootTexture.source.height * resolution;
    }

    getBackTexture(lastRenderSurface: RenderTarget, bounds: Bounds)
    {
        const renderer = this.renderer;
        const backgroundResolution = lastRenderSurface.colorTexture.source.resolution;

        const backTexture = renderer.texturePool.getTexture(
            bounds,
            backgroundResolution,
            false,
        );

        let x = bounds.minX;
        let y = bounds.minY;

        if (this.filterStackIndex)
        {
            x -= this.filterStack[this.filterStackIndex - 1].bounds.minX;
            y -= this.filterStack[this.filterStackIndex - 1].bounds.minY;
        }

        x = Math.floor(x * backgroundResolution);
        y = Math.floor(y * backgroundResolution);

        const width = Math.ceil(bounds.width * backgroundResolution);
        const height = Math.ceil(bounds.height * backgroundResolution);

        this.adaptor.copyBackTexture(
            renderer,
            lastRenderSurface,
            backTexture,
            { x, y },
            { width, height }
        );

        return backTexture;
    }

    applyFilter(filter: Filter, input: Texture, output: RenderSurface, clear: boolean)
    {
        const renderer = this.renderer;

        renderer.renderTarget.bind(output, !!clear);

        // set bind group..
        this.globalFilterBindGroup.setResource(input.source, 1);

        filter.groups[0] = renderer.globalUniforms.bindGroup;
        filter.groups[1] = this.globalFilterBindGroup;

        renderer.encoder.draw({
            geometry: quadGeometry,
            shader: filter,
            state: filter.state,
            topology: 'triangle-list'
        });
    }

    getFilterData(): FilterData
    {
        return {
            skip: false,
            inputTexture: null,
            bounds: new Bounds(),
            container: null,
            filterEffect: null,
            blendRequired: false,
            previousRenderSurface: null,
            previousGlobalBindGroup: null,
        };
    }

    /**
     * Multiply _input normalized coordinates_ to this matrix to get _sprite texture normalized coordinates_.
     *
     * Use `outputMatrix * vTextureCoord` in the shader.
     * @param outputMatrix - The matrix to output to.
     * @param {PIXI.Sprite} sprite - The sprite to map to.
     * @returns The mapped matrix.
     */
    calculateSpriteMatrix(outputMatrix: Matrix, sprite: Sprite): Matrix
    {
        const data = this.activeFilterData;

        const mappedMatrix = outputMatrix.set(
            data.inputTexture._source.width,
            0, 0,
            data.inputTexture._source.height,
            data.bounds.minX, data.bounds.minY
        );

        const worldTransform = sprite.worldTransform.copyTo(Matrix.shared);

        worldTransform.invert();
        mappedMatrix.prepend(worldTransform);
        mappedMatrix.scale(1.0 / (sprite.texture.frameWidth), 1.0 / (sprite.texture.frameHeight));

        mappedMatrix.translate(sprite.anchor.x, sprite.anchor.y);

        return mappedMatrix;
    }
}
