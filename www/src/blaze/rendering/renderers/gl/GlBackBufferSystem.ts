import { ExtensionType } from '../../../extensions/Extensions.js';
import { Shader } from '../shared/shader/Shader.js';
import { State } from '../shared/state/State.js';
import { TextureSource } from '../shared/texture/sources/TextureSource.js';
import { Texture } from '../shared/texture/Texture.js';
import { GlProgram } from './shader/GlProgram.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { RenderSurface } from '../gpu/renderTarget/GpuRenderTargetSystem.js';
import type { ISystem } from '../shared/system/ISystem.js';
import type { WebGLRenderer } from './WebGLRenderer.js';

const bigTriangleProgram = new GlProgram({
    vertex: `
        out vec2 vUv;

        void main() {
            vUv = vec2((gl_VertexID << 1) & 2, (gl_VertexID & 2));

            gl_Position = vec4(vUv * 2.0f + -1.0f, 0.0f, 1.0f);

            // flip dem UVs
            vUv.y = 1.0f - vUv.y;
        }`,
    fragment: `
        in vec2 vUv;
        out vec4 fragColor;

        uniform sampler2D uTexture;

        void main() {
            fragColor = texture(uTexture, vUv);
        }`,
    name: 'big-triangle',
});

const bigTriangleShader = new Shader({
    glProgram: bigTriangleProgram,
    resources: {
        uTexture: Texture.WHITE.source,
    },
});

export class GlBackBufferSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererSystem,
        ],
        name: 'backBuffer',
    };

    backBufferTexture: Texture;
    renderer: WebGLRenderer;
    targetTexture: Texture;
    useBackBuffer = false;

    constructor(renderer: WebGLRenderer)
    {
        this.renderer = renderer;
    }

    renderToBackBuffer(target: RenderSurface)
    {
        if (!this.useBackBuffer) return target;

        const renderTarget = this.renderer.renderTarget.getRenderTarget(target);

        this.targetTexture = renderTarget.colorTexture;

        const backBufferTexture = this._getBackBufferTexture(renderTarget.colorTexture);

        return backBufferTexture;
    }

    presentBackBuffer()
    {
        if (!this.useBackBuffer) return;

        const renderer = this.renderer;
        const gl = renderer.gl;

        renderer.renderTarget.finishRenderPass();

        renderer.renderTarget.bind(this.targetTexture, false);

        bigTriangleShader.resources.uTexture = this.backBufferTexture.source;

        renderer.shader.bind(bigTriangleShader, false);
        renderer.state.set(State.for2d());

        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    private _getBackBufferTexture(targetTexture: Texture)
    {
        const source = targetTexture.source;

        this.backBufferTexture = this.backBufferTexture || new Texture({
            source: new TextureSource({
                width: 1,
                height: 1,
                resolution: 1,
                antialias: false,
            }),
        });

        // this will not resize if its the same size already! No extra check required
        this.backBufferTexture.source.resize(
            source.width,
            source.height,
            source.resolution,
        );

        return this.backBufferTexture;
    }

    destroy()
    {
        //
    }
}
