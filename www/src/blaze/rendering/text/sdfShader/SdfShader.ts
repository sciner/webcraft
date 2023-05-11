import { Matrix } from '../../../maths/Matrix.js';
import { MAX_TEXTURES } from '../../batcher/shared/const.js';
import { Filter } from '../../filters/Filter.js';
import { batchSamplersUniformGroup } from '../../renderers/gl/shader/batchSamplersUniformGroup.js';
import { UniformGroup } from '../../renderers/shared/shader/UniformGroup.js';
import { generateDefaultSdfBatchGlProgram } from './generateDefaultSdfBatchGlProgram.js';
import { generateDefaultSdfBatchProgram } from './generateDefaultSdfBatchProgram.js';

export class SdfShader extends Filter
{
    constructor()
    {
        const uniforms = new UniformGroup({
            color: { value: new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' },
            transformMatrix: { value: new Matrix(), type: 'mat3x3<f32>' },
            distance: { value: 4, type: 'f32' },
        });

        super({
            glProgram: generateDefaultSdfBatchGlProgram(MAX_TEXTURES),
            gpuProgram: generateDefaultSdfBatchProgram(MAX_TEXTURES),
            resources: {
                localUniforms: uniforms,
                batchSamplers: batchSamplersUniformGroup,
            }
        });
    }
}
