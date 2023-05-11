import { ExtensionType } from '../../../extensions/Extensions.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { ISystem } from '../shared/system/ISystem.js';
import type { WebGPURenderer } from './WebGPURenderer.js';

export class GpuColorMaskSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGPURendererSystem,
        ],
        name: 'colorMask',
    };
    renderer: WebGPURenderer;

    colorMaskCache = 0b1111;

    constructor(renderer: WebGPURenderer)
    {
        this.renderer = renderer;
    }

    setMask(colorMask: number)
    {
        if (this.colorMaskCache === colorMask) return;
        this.colorMaskCache = colorMask;

        this.renderer.pipeline.setColorMask(colorMask);
    }

    destroy()
    {
        // boom!
    }
}
