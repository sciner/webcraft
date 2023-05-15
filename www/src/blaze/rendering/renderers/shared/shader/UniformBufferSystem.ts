import { ExtensionType } from '../../../../extensions/Extensions.js';
import { Buffer } from '../buffer/Buffer.js';
import { BufferUsage } from '../buffer/const.js';
import { createUBOElements } from './utils/createUBOElements.js';
import { generateUniformBufferSync } from './utils/createUniformBufferSync.js';

import type { ExtensionMetadata } from '../../../../extensions/Extensions.js';
import type { Renderer } from '../../types.js';
import type { ISystem } from '../system/ISystem.js';
import type { UniformGroup } from './UniformGroup.js';
import type { UniformBufferLayout } from './utils/createUBOElements.js';
import type { UniformsSyncCallback } from './utils/createUniformBufferSync.js';

export class UniformBufferSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererSystem,
            ExtensionType.WebGPURendererSystem,
            ExtensionType.CanvasRendererSystem,
        ],
        name: 'uniformBuffer',
    };

    readonly renderer: Renderer;

    /** Cache of uniform buffer layouts and sync functions, so we don't have to re-create them */
    private _syncFunctionHash: Record<string, {
        layout: UniformBufferLayout,
        syncFunction: (uniforms: Record<string, any>, data: Float32Array) => void
    }> = {};

    constructor(renderer: Renderer)
    {
        this.renderer = renderer;
    }

    initUniformGroup(uniformGroup: UniformGroup): UniformsSyncCallback
    {
        const uniformGroupSignature = uniformGroup.signature;

        let uniformData = this._syncFunctionHash[uniformGroupSignature];

        if (!uniformData)
        {
            const elements = Object.keys(uniformGroup.uniformStructures).map((i) => uniformGroup.uniformStructures[i]);

            const layout = createUBOElements(elements as any);

            const syncFunction = generateUniformBufferSync(layout.uboElements);

            uniformData = this._syncFunctionHash[uniformGroupSignature] = {
                layout,
                syncFunction
            };
        }

        uniformGroup._syncFunction = uniformData.syncFunction;

        uniformGroup.buffer = new Buffer({
            data: new Float32Array(uniformData.layout.size / 4),
            usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
        });

        return uniformGroup._syncFunction;
    }

    updateUniformGroup(uniformGroup: UniformGroup): boolean
    {
        if (uniformGroup.isStatic && !uniformGroup.dirtyId) return false;
        uniformGroup.dirtyId = 0;

        const syncFunction = uniformGroup._syncFunction || this.initUniformGroup(uniformGroup);

        syncFunction(uniformGroup.uniforms, uniformGroup.buffer.data);

        uniformGroup.buffer.update();

        return true;
    }

    destroy(): void
    {
        throw new Error('Method not implemented.');
    }
}
