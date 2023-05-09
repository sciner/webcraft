import { Cache } from '../../../assets/cache/Cache';
import { ExtensionType } from '../../../extensions/Extensions';
import { GraphicsContext } from '../../graphics/shared/GraphicsContext';
import { GraphicsRenderable } from '../../graphics/shared/GraphicsRenderable';
import { SdfShader } from '../sdfShader/SdfShader';
import { BitmapFontManager } from './BitmapFontManager';
import { getBitmapTextLayout } from './utils/getBitmapTextLayout';

import type { ExtensionMetadata } from '../../../extensions/Extensions';
import type { GpuProgram } from '../../renderers/gpu/shader/GpuProgram';
import type { InstructionSet } from '../../renderers/shared/instructions/InstructionSet';
import type { RenderablePipe } from '../../renderers/shared/instructions/RenderPipe';
import type { UniformGroup } from '../../renderers/shared/shader/UniformGroup';
import type { Renderer } from '../../renderers/types';
import type { TextRenderable } from '../TextRenderable';

export class BitmapTextPipe implements RenderablePipe<TextRenderable>
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererPipes,
            ExtensionType.WebGPURendererPipes,
            ExtensionType.CanvasRendererPipes,
        ],
        name: 'bitmapText',
    };

    instructionSet: InstructionSet;
    renderer: Renderer;

    gpuBitmapText: Record<string, {
        graphicsRenderable: GraphicsRenderable,
    }> = {};

    sdfProgram: GpuProgram;
    uniforms: UniformGroup;
    sdfShader: SdfShader;

    constructor(renderer: Renderer)
    {
        this.renderer = renderer;
    }

    validateRenderable(renderable: TextRenderable): boolean
    {
        const { graphicsRenderable } = this.getGpuBitmapText(renderable);

        this.updateContext(renderable, graphicsRenderable.context);

        // this.renderer.graphicsContext.updateGpuContext(graphicsRenderable.context);
        // TODO this is a bit of a hack, but we need to make sure that the context is updated
        // maybe it should update when in the invalidate method of the graphics?
        // eslint-disable-next-line dot-notation
        this.renderer.graphicsContext['validateContexts']();

        return this.renderer.renderPipes.graphics.validateRenderable(graphicsRenderable);

        // TODO - need to shift all the verts in the graphicsData to the new anchor

        // update the anchor...

        return false;
    }

    bind(instructionSet: InstructionSet)
    {
        this.instructionSet = instructionSet;
    }

    addRenderable(renderable: TextRenderable)
    {
        const { graphicsRenderable } = this.getGpuBitmapText(renderable);

        // TODO break the batch if we are not batching..
        this.renderer.renderPipes.batch.break();

        this.renderer.instructions.buildAdd(graphicsRenderable);

        if (graphicsRenderable.context.customShader)
        {
            this.updateDistanceField(renderable);
        }
    }

    updateRenderable(renderable: TextRenderable)
    {
        const { graphicsRenderable } = this.getGpuBitmapText(renderable);

        this.renderer.renderPipes.graphics.updateRenderable(graphicsRenderable);

        if (graphicsRenderable.context.customShader)
        {
            this.updateDistanceField(renderable);
        }
    }

    updateVisibility(renderable: TextRenderable)
    {
        const { graphicsRenderable } = this.getGpuBitmapText(renderable);

        graphicsRenderable.visible = renderable.visible;

        this.renderer.renderPipes.graphics.updateVisibility(graphicsRenderable);
    }

    updateContext(renderable: TextRenderable, context: GraphicsContext)
    {
        const bitmapFont = BitmapFontManager.getFont(renderable.text, renderable._style);

        context.clear();

        if (bitmapFont.distanceField.fieldType !== 'none')
        {
            if (!context.customShader)
            {
                if (!this.sdfShader)
                {
                    this.sdfShader = new SdfShader();
                }

                context.customShader = this.sdfShader;
            }
        }

        const chars = Array.from(renderable.text);
        const style = renderable._style;

        let currentY = (style._stroke?.width || 0) / 2;

        currentY += bitmapFont.baseLineOffset;

        // measure our text...
        const bitmapTextLayout = getBitmapTextLayout(chars, style, bitmapFont);

        let index = 0;

        const scale = style.fontSize / bitmapFont.baseMeasurementFontSize;

        context.scale(scale, scale);

        const offsetX = -renderable.anchor.x * bitmapTextLayout.width;
        const offsetY = -renderable.anchor.y * bitmapTextLayout.height;

        context.translate(offsetX, offsetY);

        const tint = style._fill.color;

        for (let i = 0; i < bitmapTextLayout.lines.length; i++)
        {
            const line = bitmapTextLayout.lines[i];

            for (let j = 0; j < line.charPositions.length; j++)
            {
                const char = chars[index++];

                const charData = bitmapFont.chars[char];

                if (charData?.texture)
                {
                    context.texture(
                        charData.texture,
                        tint,
                        Math.round(line.charPositions[j] + charData.xOffset),
                        Math.round(currentY + charData.yOffset),
                    );
                }
            }

            currentY += bitmapFont.lineHeight;
        }
    }

    getGpuBitmapText(renderable: TextRenderable)
    {
        return this.gpuBitmapText[renderable.uid] || this.initGpuText(renderable);
    }

    initGpuText(renderable: TextRenderable)
    {
        renderable._style.update();

        const context = new GraphicsContext();

        this.gpuBitmapText[renderable.uid] = {
            graphicsRenderable: new GraphicsRenderable(renderable.data, context),
        };

        this.updateContext(renderable, context);

        return this.gpuBitmapText[renderable.uid];
    }

    updateDistanceField(renderable: TextRenderable)
    {
        const { graphicsRenderable } = this.getGpuBitmapText(renderable);

        const fontFamily = renderable._style.fontFamily as string;
        const dynamicFont = Cache.get(fontFamily as string);

        // Inject the shader code with the correct value
        const { a, b, c, d } = renderable.matrix;

        const dx = Math.sqrt((a * a) + (b * b));
        const dy = Math.sqrt((c * c) + (d * d));
        const worldScale = (Math.abs(dx) + Math.abs(dy)) / 2;

        const fontScale = dynamicFont.baseRenderedFontSize / renderable._style.fontSize;

        // TODO take the correct resolution..
        const resolution = 1;// this.renderer.view.resolution;
        const distance = worldScale * dynamicFont.distanceField.distanceRange * (1 / fontScale) * resolution;

        graphicsRenderable.context.customShader.resources.localUniforms.uniforms.distance = distance;
        //  this.adaptor.updateDistanceField(graphicsRenderable.context, distance);

        // this.uniforms.uniforms.distance = distance;

        // const uniformGroup = graphicsRenderable.context.customShader.groups[2].resources[0];

        // //  console.log(distance);

        // uniformGroup.uniforms.distance = distance;

        // uniformGroup.update();

        // this.renderer.uniformBuffer.updateUniformAndUploadGroup(uniformGroup);
    }
}
