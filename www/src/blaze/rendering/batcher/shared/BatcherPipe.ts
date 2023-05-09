import { ExtensionType } from '../../../extensions/Extensions';
import { State } from '../../renderers/shared/state/State';
import { getBatchedGeometry } from '../gpu/getBatchedGeometry';
import { Batcher } from './Batcher';

import type { ExtensionMetadata } from '../../../extensions/Extensions';
import type { Geometry } from '../../renderers/shared/geometry/Geometry';
import type { InstructionSet } from '../../renderers/shared/instructions/InstructionSet';
import type { BatchPipe, InstructionGenerator, InstructionRunner } from '../../renderers/shared/instructions/RenderPipe';
import type { Renderer } from '../../renderers/types';
import type { Batch, BatchableObject } from './Batcher';

export interface BatcherAdaptor
{
    init(): void;
    execute(batchPipe: BatcherPipe, batch: Batch): void
}

// eslint-disable-next-line max-len
export class BatcherPipe implements InstructionRunner<Batch>, InstructionGenerator, BatchPipe
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererPipes,
            ExtensionType.WebGPURendererPipes,
            ExtensionType.CanvasRendererPipes,
        ],
        name: 'batch',
    };

    toUpdate: BatchableObject[] = [];
    instructionSet: InstructionSet;
    activeBatcher: {
        geometry: Geometry;
        batcher: Batcher
    };

    // shader: GpuShader;
    state: State = State.for2d();
    lastBatch: number;
    private _batches: Record<number, {
        geometry: Geometry;
        batcher: Batcher
    }> = {};
    renderer: Renderer;
    adaptor: BatcherAdaptor;

    constructor(renderer: Renderer, adaptor: BatcherAdaptor)
    {
        this.renderer = renderer;
        this.adaptor = adaptor;

        this.adaptor.init();
    }

    bind(instructionSet: InstructionSet)
    {
        this.instructionSet = instructionSet;
        this.activeBatcher = this._batches[instructionSet.id];

        if (!this.activeBatcher)
        {
            this.activeBatcher = this._batches[instructionSet.id] = {
                batcher: new Batcher(),
                geometry: getBatchedGeometry(),
            };
        }
    }

    buildStart()
    {
        this.lastBatch = 0;
        this.activeBatcher.batcher.begin();
    }

    addToBatch(batchableObject: BatchableObject, visible: boolean)
    {
        this.activeBatcher.batcher.add(batchableObject, visible);
    }

    break()
    {
        const batcher = this.activeBatcher.batcher;
        const instructionSet = this.instructionSet;

        const hardBreak = instructionSet.instructionSize > 0 && (this.instructionSet.lastInstruction().type !== 'batch');

        batcher.break(hardBreak);

        while (this.lastBatch < batcher.batchIndex)
        {
            const batch = batcher.batches[this.lastBatch++];

            // TODO feel we can avoid this check...
            if (batch.elementSize !== 0)
            {
                instructionSet.instructions[instructionSet.instructionSize++] = batch;
            }
        }
    }

    buildEnd()
    {
        const batcher = this.activeBatcher.batcher;
        const geometry = this.activeBatcher.geometry;

        if (batcher.elementSize === 0) return;

        batcher.finish();

        geometry.indexBuffer.data = batcher.indexBuffer;

        geometry.buffers[0].data = batcher.attributeBuffer.float32View;

        geometry.indexBuffer.update(batcher.indexSize * 4);
    }

    upload()
    {
        const instructionSet = this.instructionSet;
        const activeBatcher = this._batches[instructionSet.id];

        // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
        if (activeBatcher && activeBatcher.batcher.dirty)
        {
            activeBatcher.batcher.dirty = false;

            const attributeBuffer = activeBatcher.geometry.buffers[0];

            attributeBuffer.update(activeBatcher.batcher.attributeSize * 4);
            this.renderer.buffer.updateBuffer(attributeBuffer);
        }
    }

    execute(batch: Batch)
    {
        this.adaptor.execute(this, batch);
    }
}
