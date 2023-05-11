import { generateBatchProgram } from './generateBatchProgram.js';

import type { GpuProgram } from '../../renderers/gpu/shader/GpuProgram.js';
import {batcher_template_src} from "../batcher_template_src.js";

export function generateDefaultBatchProgram(maxTextures: number): GpuProgram
{
    return generateBatchProgram({
        vertex: {
            source: batcher_template_src.source,
            entryPoint: 'mainVertex',
        },
        fragment: {
            source: batcher_template_src.source,
            entryPoint: 'mainFragment',
        },
        maxTextures,
    });
}
