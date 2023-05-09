import type { TextureSource } from '../../../shared/texture/sources/TextureSource';
import type { GlRenderingContext } from '../../context/GlRenderingContext';
import type { GlTexture } from '../GlTexture';

export interface GLTextureUploader
{
    type: string;
    upload(source: TextureSource, glTexture: GlTexture, gl: GlRenderingContext): void;
}
