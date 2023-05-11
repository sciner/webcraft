import { MAX_TEXTURES } from '../../../batcher/shared/const.js';
import { UniformGroup } from '../../shared/shader/UniformGroup.js';

const sampleValues = new Int32Array(MAX_TEXTURES);

for (let i = 0; i < MAX_TEXTURES; i++)
{
    sampleValues[i] = i;
}

export const batchSamplersUniformGroup = new UniformGroup({ uSamplers: sampleValues }, { isStatic: true });
