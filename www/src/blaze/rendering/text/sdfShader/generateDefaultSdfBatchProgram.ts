import { generateBatchProgram } from '../../batcher/gpu/generateBatchProgram.js';

import type { GpuProgram } from '../../renderers/gpu/shader/GpuProgram.js';
import { sdf_batcher_src } from "./sdf_batcher_src.js";

export function generateDefaultSdfBatchProgram(maxTextures: number): GpuProgram
{
    return generateBatchProgram({
        vertex: {
            source: sdf_batcher_src.source,
            entryPoint: 'mainVertex',
        },
        fragment: {
            source: sdf_batcher_src.source,
            entryPoint: 'mainFragment',
        },
        maxTextures,
    });
}
