import { ExtensionType } from '../../../extensions/Extensions.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { WebGLRenderer } from '../../renderers/gl/WebGLRenderer.js';
import type { RenderTarget } from '../../renderers/shared/renderTarget/RenderTarget.js';
import type { Texture } from '../../renderers/shared/texture/Texture.js';
import type { FilterAdaptor } from '../shared/FilterPipe.js';

export class GlFilterAdaptor implements FilterAdaptor
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererPipesAdaptor,
        ],
        name: 'filter',
    };
    copyBackTexture(
        renderer: WebGLRenderer,
        sourceRenderSurfaceTexture: RenderTarget,
        destinationTexture: Texture,
        origin: { x: number; y: number; },
        size: { width: number; height: number; }
    ): Texture
    {
        const baseTexture = renderer.renderTarget.getGpuColorTexture(sourceRenderSurfaceTexture);

        renderer.renderTarget.bind(baseTexture, false);

        renderer.texture.bind(destinationTexture, 0);

        const gl = renderer.gl;

        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0,
            0, 0,
            origin.x,
            origin.y,
            size.width,
            size.height
        );

        return destinationTexture;
    }
}
