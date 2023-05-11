import { generateBatchGlProgram } from '../../batcher/gl/generateBatchGlProgram.js';

import type { GlProgram } from '../../renderers/gl/shader/GlProgram.js';
import {sdf_batcher_src} from "./sdf_batcher_src.js";

export function generateDefaultSdfBatchGlProgram(maxTextures: number): GlProgram
{
    return generateBatchGlProgram({
        vertexSrc: sdf_batcher_src.vertex,
        fragmentSrc: sdf_batcher_src.fragment,
        maxTextures,
        name: 'sdf'
    });
}
