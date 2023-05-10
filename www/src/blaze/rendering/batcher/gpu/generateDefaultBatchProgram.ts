import { generateBatchProgram } from './generateBatchProgram';

import type { GpuProgram } from '../../renderers/gpu/shader/GpuProgram';
import {batcher_template_src} from "../batcher_template_src";

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
