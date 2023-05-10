import { generateBatchGlProgram } from './generateBatchGlProgram';

import type { GlProgram } from '../../renderers/gl/shader/GlProgram';
import { batcher_template_src } from '../batcher_template_src.js';

export function generateDefaultBatchGlProgram(maxTextures: number): GlProgram
{
    return generateBatchGlProgram({
        vertexSrc: batcher_template_src.vertex,
        fragmentSrc: batcher_template_src.fragment,
        maxTextures,
    });
}
