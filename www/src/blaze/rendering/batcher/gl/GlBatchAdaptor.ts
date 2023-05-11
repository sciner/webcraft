import { ExtensionType } from '../../../extensions/Extensions.js';
import { Matrix } from '../../../maths/Matrix.js';
import { batchSamplersUniformGroup } from '../../renderers/gl/shader/batchSamplersUniformGroup.js';
import { Shader } from '../../renderers/shared/shader/Shader.js';
import { UniformGroup } from '../../renderers/shared/shader/UniformGroup.js';
import { MAX_TEXTURES } from '../shared/const';
import { generateDefaultBatchGlProgram } from './generateDefaultBatchGlProgram.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { WebGLRenderer } from '../../renderers/gl/WebGLRenderer.js';
import type { Batch } from '../shared/Batcher.js';
import type { BatcherAdaptor, BatcherPipe } from '../shared/BatcherPipe.js';

export class GlBatchAdaptor implements BatcherAdaptor
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererPipesAdaptor,
        ],
        name: 'batch',
    };
    shader: Shader;
    didUpload = false;

    init()
    {
        const uniforms = new UniformGroup({
            tint: { value: new Float32Array([1, 1, 1, 1]), type: 'f32' },
            translationMatrix: { value: new Matrix(), type: 'mat3x3<f32>' },
            batchSamplers: batchSamplersUniformGroup,
        });

        this.shader = new Shader({
            glProgram: generateDefaultBatchGlProgram(MAX_TEXTURES),
            resources: {
                uniforms
            }
        });
    }

    execute(batchPipe: BatcherPipe, batch: Batch): void
    {
        const renderer = batchPipe.renderer as WebGLRenderer;

        batchPipe.state.blendMode = batch.blendMode;

        renderer.state.set(batchPipe.state);

        renderer.shader.bind(this.shader, this.didUpload);

        this.didUpload = true;

        renderer.geometry.bind(batchPipe.activeBatcher.geometry, this.shader.glProgram);

        for (let i = 0; i < batch.textures.textures.length; i++)
        {
            renderer.texture.bind(batch.textures.textures[i], i);
        }

        renderer.shader.bindUniformBlock(renderer.globalUniforms.uniformGroup, 'globalUniforms', 0);

        renderer.geometry.draw('triangle-list', batch.size, batch.start);
    }
}
