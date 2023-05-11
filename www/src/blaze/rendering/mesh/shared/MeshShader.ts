import { GlProgram } from '../../renderers/gl/shader/GlProgram.js';
import { GpuProgram } from '../../renderers/gpu/shader/GpuProgram.js';
import { Shader } from '../../renderers/shared/shader/Shader.js';
import { mesh_src } from '../mesh_src.js';

import type { Texture } from '../../renderers/shared/texture/Texture.js';

interface MeshShaderOptions
{
    texture: Texture;
}

export class MeshShader extends Shader
{
    private _texture: Texture;

    batch = true;

    constructor(options: MeshShaderOptions)
    {
        const glProgram = GlProgram.from({
            vertex: mesh_src.vertex,
            fragment: mesh_src.fragment,
            name: 'mesh-default',
        });

        const gpuProgram = GpuProgram.from({
            vertex: {
                source: mesh_src.source,
                entryPoint: 'mainVertex',
            },
            fragment: {
                source: mesh_src.source,
                entryPoint: 'mainFragment',
            }
        });

        super({
            glProgram,
            gpuProgram,
            resources: {
                uTexture: options.texture.source,
                uSampler: options.texture.style,
            }
        });
    }

    get texture(): Texture
    {
        return this._texture;
    }

    set texture(value: Texture)
    {
        if (this._texture === value) return;

        this._texture = value;

        this.resources.uTexture = value.source;
        this.resources.uSampler = value.style;
    }
}
