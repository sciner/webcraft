import { ExtensionType } from '../../../extensions/Extensions';
import { colorToUniform } from '../../graphics/gpu/colorToUniform';

import type { ExtensionMetadata } from '../../../extensions/Extensions';
import type { WebGPURenderer } from '../../renderers/gpu/WebGPURenderer';
import type { MeshAdaptor, MeshPipe } from '../shared/MeshPipe';
import type { MeshRenderable } from '../shared/MeshRenderable';

export class GpuMeshAdapter implements MeshAdaptor
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGPURendererPipesAdaptor,
        ],
        name: 'mesh',
    };

    execute(meshPipe: MeshPipe, renderable: MeshRenderable)
    {
        const renderer = meshPipe.renderer;
        const state = meshPipe.state;

        state.blendMode = renderable.data.worldBlendMode & 0b1111;

        const localUniforms = meshPipe.localUniforms;

        localUniforms.uniforms.transformMatrix = renderable.matrix;
        localUniforms.update();

        colorToUniform(
            renderable.data.worldTint,
            renderable.data.worldAlpha,
            localUniforms.uniforms.color,
            0
        );

        let shader = renderable.shader;

        if (!shader)
        {
            shader = meshPipe.meshShader;

            shader.groups[2] = (renderer as WebGPURenderer)
                .texture.getTextureBindGroup(renderable.texture);
        }

        // GPU..
        shader.groups[0] = renderer.globalUniforms.bindGroup;

        shader.groups[1] = (renderer as WebGPURenderer)
            .renderPipes.uniformBatch.getUniformBindGroup(localUniforms, true);

        renderer.encoder.draw({
            geometry: renderable._geometry,
            shader,
            state
        });
    }
}
