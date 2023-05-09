import { ExtensionType } from '../../../extensions/Extensions';

import type { ExtensionMetadata } from '../../../extensions/Extensions';
import type { WebGPURenderer } from '../../renderers/gpu/WebGPURenderer';
import type { RenderTarget } from '../../renderers/shared/renderTarget/RenderTarget';
import type { Texture } from '../../renderers/shared/texture/Texture';
import type { FilterAdaptor } from '../shared/FilterPipe';

export class GpuFilterAdapter implements FilterAdaptor
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGPURendererPipesAdaptor,
        ],
        name: 'filter',
    };
    copyBackTexture(
        renderer: WebGPURenderer,
        sourceRenderSurfaceTexture: RenderTarget,
        destinationTexture: Texture,
        origin: { x: number; y: number; },
        size: { width: number; height: number; }
    ): Texture
    {
        const baseGpuTexture = renderer.renderTarget.getGpuColorTexture(sourceRenderSurfaceTexture);
        const backGpuTexture = renderer.texture.getGpuSource(destinationTexture.source);

        renderer.encoder.commandEncoder.copyTextureToTexture({
            texture: baseGpuTexture,
            origin,
        }, {
            texture: backGpuTexture,
        }, size);

        return destinationTexture;
    }
}
