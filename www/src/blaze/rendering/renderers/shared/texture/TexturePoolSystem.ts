import { ExtensionType } from '../../../../extensions/Extensions.js';
import { Matrix } from '../../../../maths/Matrix.js';
import { TexturePool } from './TexturePool.js';

import type { ExtensionMetadata } from '../../../../extensions/Extensions.js';
import type { Bounds } from '../../../scene/bounds/Bounds.js';
import type { Renderer } from '../../types.js';
import type { ISystem } from '../system/ISystem.js';
import type { Texture } from './Texture.js';

const tempMatrix = new Matrix();

export class TexturePoolSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererSystem,
            ExtensionType.WebGPURendererSystem,
            ExtensionType.CanvasRendererSystem,
        ],
        name: 'texturePool',
    };

    renderer: Renderer;

    texturePool: TexturePool = new TexturePool();

    constructor(renderer: Renderer)
    {
        this.renderer = renderer;
    }

    bind(srcFrame: Bounds, resolution: number, antialias: boolean): Texture
    {
        const renderer = this.renderer;

        // get a P02 texture from our pool...
        const texture = this.getTexture(srcFrame, resolution, antialias);

        const boundsMatrix = tempMatrix;

        boundsMatrix.tx = -srcFrame.minX;
        boundsMatrix.ty = -srcFrame.minY;

        const renderTarget = renderer.renderTarget.bind(texture, true);// , texture.color);
        // set the global uniforms to take into account the bounds offset required

        renderer.globalUniforms.bind(renderTarget.projectionMatrix, boundsMatrix, 1);

        return texture;
    }

    push(srcFrame: Bounds, resolution: number, antialias: boolean)
    {
        const renderer = this.renderer;

        // get a P02 texture from our pool...
        const texture = this.getTexture(srcFrame, resolution, antialias);

        const boundsMatrix = tempMatrix;

        boundsMatrix.tx = -srcFrame.minX;
        boundsMatrix.ty = -srcFrame.minY;

        if (!texture.color)
        {
            texture.color = [Math.random(), Math.random(), Math.random(), 1];
        }

        const renderTarget = renderer.renderTarget.push(texture, true, texture.color);
        // set the global uniforms to take into account the bounds offset required

        renderer.globalUniforms.push(renderTarget.projectionMatrix, boundsMatrix, 1);

        return texture;
    }

    pop(): void
    {
        const renderer = this.renderer;

        renderer.renderTarget.pop();
        renderer.globalUniforms.pop();
    }

    getTexture(srcFrame: Bounds, resolution: number, antialias: boolean): Texture
    {
        // get a P02 texture from our pool...
        const texture = this.texturePool.getOptimalTexture(
            srcFrame.width,
            srcFrame.height,
            resolution,
            antialias,
        );

        texture.frameX = 0;
        texture.frameY = 0;

        texture.frameWidth = srcFrame.width;
        texture.frameHeight = srcFrame.height;

        texture.layout.update();

        return texture;
    }

    returnTexture(texture: Texture): void
    {
        this.texturePool.returnTexture(texture);
    }

    destroy()
    {
        // boom
    }
}
