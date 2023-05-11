import { BindGroup } from '../../renderers/gpu/shader/BindGroup.js';
import { Texture } from '../../renderers/shared/texture/Texture.js';
import { MAX_TEXTURES } from '../shared/const.js';

import type { BindableTexture } from '../../renderers/shared/texture/Texture.js';

const cachedGroups: Record<string, BindGroup> = {};

export function getTextureBatchBindGroup(textures: BindableTexture[])
{
    const key = textures.map((t) => t.styleSourceKey).join('-');

    return cachedGroups[key] || generateTextureBatchBindGroup(textures, key);
}

function generateTextureBatchBindGroup(textures: BindableTexture[], key: string): BindGroup
{
    const bindGroupResources: Record<string, any> = {};

    let bindIndex = 0;

    for (let i = 0; i < MAX_TEXTURES; i++)
    {
        const texture = i < textures.length ? textures[i] : Texture.EMPTY.source;

        bindGroupResources[bindIndex++] = texture.source;
        bindGroupResources[bindIndex++] = texture.style;
    }

    // pad out with empty textures
    const bindGroup = new BindGroup(bindGroupResources);

    cachedGroups[key] = bindGroup;

    return bindGroup;
}

