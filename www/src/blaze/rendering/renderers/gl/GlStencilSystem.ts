import { ExtensionType } from '../../../extensions/Extensions.js';
import { GpuStencilModesToPixi } from '../gpu/state/GpuStencilModesToPixi.js';
import { STENCIL_MODES } from '../shared/state/const.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { ISystem } from '../shared/system/ISystem.js';
import type { WebGLRenderer } from './WebGLRenderer.js';

export class GlStencilSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererSystem,
        ],
        name: 'stencil',
    };

    renderer: WebGLRenderer;

    stencilCache = {
        enabled: false,
        stencilReference: 0,
    };
    currentStencilMode: STENCIL_MODES;

    stencilOpsMapping: {
        keep: number;
        zero: number;
        replace: number;
        invert: number;
        increment: number;
        decrement: number;
        incrementWrap: number;
        decrementWrap: number;
    };

    comparisonFuncMapping: {
        always: number;
        never: number;
        equal: number;
        notEqual: number;
        less: number;
        lessEqual: number;
        greater: number;
        greaterEqual: number;
    };

    constructor(renderer: WebGLRenderer)
    {
        this.renderer = renderer;
    }

    contextChange(gl: WebGLRenderingContext)
    {
        // TODO - this could be declared in a gl const
        // we know the numbers don't tend to change!

        this.comparisonFuncMapping = {
            always: gl.ALWAYS,
            never: gl.NEVER,
            equal: gl.EQUAL,
            notEqual: gl.NOTEQUAL,
            less: gl.LESS,
            lessEqual: gl.LEQUAL,
            greater: gl.GREATER,
            greaterEqual: gl.GEQUAL,
        };

        this.stencilOpsMapping = {
            keep: gl.KEEP,
            zero: gl.ZERO,
            replace: gl.REPLACE,
            invert: gl.INVERT,
            increment: gl.INCR,
            decrement: gl.DECR,
            incrementWrap: gl.INCR_WRAP,
            decrementWrap: gl.DECR_WRAP,
        };
    }

    setStencilMode(stencilMode: STENCIL_MODES, stencilReference: number)
    {
        if (this.currentStencilMode === stencilMode)
        {
            if (stencilReference !== this.stencilCache.stencilReference)
            {
                this.stencilCache.stencilReference = stencilReference;

                const gl = this.renderer.gl;

                gl.stencilFunc(this.comparisonFuncMapping[stencilMode], stencilReference, 0xFFFFFF);
            }
        }

        this.currentStencilMode = stencilMode;

        const mode = GpuStencilModesToPixi[stencilMode];

        const gl = this.renderer.gl;

        if (stencilMode === STENCIL_MODES.DISABLED)
        {
            if (this.stencilCache.enabled)
            {
                this.stencilCache.enabled = false;

                gl.clear(gl.STENCIL_BUFFER_BIT);
                gl.disable(gl.STENCIL_TEST);
            }

            return;
        }

        if (!this.stencilCache.enabled)
        {
            this.stencilCache.enabled = true;
            gl.enable(gl.STENCIL_TEST);
        }

        // this is pretty simple mapping.
        // will work for pixi's simple mask cases.
        // although a true mapping of the GPU state to webGL state should be done
        gl.stencilFunc(this.comparisonFuncMapping[mode.stencilBack.compare], stencilReference, 0xFFFFFF);
        gl.stencilOp(gl.KEEP, gl.KEEP, this.stencilOpsMapping[mode.stencilBack.passOp]);
    }

    destroy() {

    }
}
