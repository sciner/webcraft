import type { TextureSource } from '../../../shared/texture/sources/TextureSource.js';
import type { GlRenderingContext } from '../../context/GlRenderingContext.js';
import type { GlTexture } from '../GlTexture.js';

export interface GLTextureUploader
{
    type: string;
    upload(source: TextureSource, glTexture: GlTexture, gl: GlRenderingContext): void;
}
