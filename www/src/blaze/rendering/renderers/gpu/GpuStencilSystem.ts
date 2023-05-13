import { ExtensionType } from '../../../extensions/Extensions.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { STENCIL_MODES } from '../shared/state/const.js';
import type { ISystem } from '../shared/system/ISystem.js';
import type { WebGPURenderer } from './WebGPURenderer.js';

export class GpuStencilSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGPURendererSystem,
        ],
        name: 'stencil',
    };
    renderer: WebGPURenderer;

    stencilCache = {
        enabled: false,
        stencilReference: 0,
    };
    currentStencilMode: STENCIL_MODES;

    constructor(renderer: WebGPURenderer)
    {
        this.renderer = renderer;
    }

    setStencilMode(stencilMode: STENCIL_MODES, stencilReference: number)
    {
        const renderer = this.renderer;

        renderer.pipeline.setStencilMode(stencilMode);
        renderer.encoder.renderPassEncoder.setStencilReference(stencilReference);
    }

    destroy() {

    }
}
