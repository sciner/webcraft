import { ExtensionType } from '../../../extensions/Extensions';

import type { ExtensionMetadata } from '../../../extensions/Extensions';
import type { ISystem } from '../shared/system/ISystem';
import type { WebGPURenderer } from './WebGPURenderer';

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
