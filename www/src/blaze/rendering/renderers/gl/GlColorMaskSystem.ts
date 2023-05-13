import { ExtensionType } from '../../../extensions/Extensions.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { ISystem } from '../shared/system/ISystem.js';
import type { WebGLRenderer } from './WebGLRenderer.js';

export class GlColorMaskSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererSystem,
        ],
        name: 'colorMask',
    };

    renderer: WebGLRenderer;

    colorMaskCache = 0b1111;

    constructor(renderer: WebGLRenderer)
    {
        this.renderer = renderer;
    }

    setMask(colorMask: number)
    {
        if (this.colorMaskCache === colorMask) return;
        this.colorMaskCache = colorMask;

        this.renderer.gl.colorMask(
            !!(colorMask & 0b1000),
            !!(colorMask & 0b0100),
            !!(colorMask & 0b0010),
            !!(colorMask & 0b0001)
        );
    }

    destroy() {

    }
}
