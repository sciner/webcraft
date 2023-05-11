import { ExtensionType } from '../../../extensions/Extensions.js';
import { Matrix } from '../../../maths/Matrix.js';
import { BindGroup } from '../../renderers/gpu/shader/BindGroup.js';
import { Buffer } from '../../renderers/shared/buffer/Buffer.js';
import { BufferUsage } from '../../renderers/shared/buffer/const.js';
import { UniformGroup } from '../../renderers/shared/shader/UniformGroup.js';
import { State } from '../../renderers/shared/state/State.js';
import { Texture } from '../../renderers/shared/texture/Texture.js';
import { BatchableMesh } from './BatchableMesh.js';
import { MeshShader } from './MeshShader.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { InstructionSet } from '../../renderers/shared/instructions/InstructionSet.js';
import type {
    InstructionGenerator,
    InstructionRunner,
    RenderablePipe
} from '../../renderers/shared/instructions/RenderPipe.js';
import type { Renderer } from '../../renderers/types.js';
import type { MeshRenderable } from './MeshRenderable.js';

// TODO Record mode is a P2, will get back to this as it's not a priority
// const recordMode = true;

class MeshData
{
    localBuffer = new Buffer({ data: new Float32Array(16), usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST });
    localBindGroup = new BindGroup({
        0: this.localBuffer
    });
}

interface RenderableData
{
    batched: boolean;
    indexSize: number;
    vertexSize: number;
}

export interface MeshAdaptor
{
    execute(meshPipe: MeshPipe, renderable: MeshRenderable): void;
}

// eslint-disable-next-line max-len
export class MeshPipe implements RenderablePipe<MeshRenderable>, InstructionRunner<MeshRenderable>, InstructionGenerator
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererPipes,
            ExtensionType.WebGPURendererPipes,
            ExtensionType.CanvasRendererPipes,
        ],
        name: 'mesh',
    };

    state: State = State.for2d();
    firstRenderPass = true;
    renderableHash: Record<number, RenderableData> = {};
    gpuMeshDataHash: Record<number, MeshData> = {};
    gpuBatchableMeshHash: Record<number, BatchableMesh> = {};
    instructionSet: InstructionSet;
    renderer: Renderer;

    localUniforms = new UniformGroup({
        transformMatrix: { value: new Matrix(), type: 'mat3x3<f32>' },
        color: { value: new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' },
    });

    localUniformsBindGroup = new BindGroup({
        0: this.localUniforms,
    });

    adaptor: MeshAdaptor;

    meshShader = new MeshShader({
        texture: Texture.EMPTY,
    });

    constructor(renderer: Renderer, adaptor: MeshAdaptor)
    {
        this.renderer = renderer;
        this.adaptor = adaptor;
    }

    bind(instructionSet: InstructionSet)
    {
        this.instructionSet = instructionSet;
    }

    validateRenderable(renderable: MeshRenderable): boolean
    {
        renderable.dirty = false;

        const renderableData = this.getRenderableData(renderable);

        const wasBatched = renderableData.batched;

        const isBatched = renderable.batched;

        renderableData.batched = isBatched;

        if (wasBatched !== isBatched)
        {
            return true;
        }
        else if (isBatched)
        {
            const geometry = renderable._geometry;

            // no need to break the batch if it's the same size
            if (geometry.indices.length !== renderableData.indexSize
                    || geometry.positions.length !== renderableData.vertexSize)
            {
                renderableData.indexSize = geometry.indices.length;
                renderableData.vertexSize = geometry.positions.length;

                return true;
            }

            const batchableMesh = this.getBatchableMesh(renderable);

            const texture = renderable.texture;

            if (batchableMesh.texture !== texture)
            {
                batchableMesh.texture = texture;

                const canUse = batchableMesh.batch.checkCanUseTexture(batchableMesh);

                if (!canUse)
                {
                    return true;
                }
            }
        }

        return false;
    }

    addRenderable(renderable: MeshRenderable)
    {
        const instructionSet = this.instructionSet;
        const batcher = this.renderer.renderPipes.batch;

        const { batched } = this.getRenderableData(renderable);

        if (batched)
        {
            const gpuBatchableMesh = this.getBatchableMesh(renderable);

            batcher.addToBatch(gpuBatchableMesh, renderable.visible);
        }
        else
        {
            batcher.break();

            instructionSet.addInstruction(renderable);
        }
    }

    updateRenderable(renderable: MeshRenderable)
    {
        if (renderable.batched)
        {
            const gpuBatchableMesh = this.gpuBatchableMeshHash[renderable.uid];

            gpuBatchableMesh.batch.updateElement(gpuBatchableMesh);
        }
    }

    updateVisibility(renderable: MeshRenderable)
    {
        if (renderable.batched)
        {
            const gpuBatchableMesh = this.gpuBatchableMeshHash[renderable.uid];

            if (!renderable.visible)
            {
                gpuBatchableMesh.batch.hideElement(gpuBatchableMesh);
            }
        }
    }

    getRenderableData(renderable: MeshRenderable): RenderableData
    {
        return this.renderableHash[renderable.uid] || this.initRenderableData(renderable);
    }

    initRenderableData(renderable: MeshRenderable): RenderableData
    {
        this.renderableHash[renderable.uid] = {
            batched: renderable.batched,
            indexSize: renderable._geometry.indices.length,
            vertexSize: renderable._geometry.positions.length,
        };

        renderable.dirty = false;

        return this.renderableHash[renderable.uid];
    }

    execute(renderable: MeshRenderable)
    {
        if (!renderable.visible) return;

        this.adaptor.execute(this, renderable);
    }

    getMeshData(renderable: MeshRenderable): MeshData
    {
        return this.gpuMeshDataHash[renderable.uid] || this.initMeshData(renderable);
    }

    initMeshData(renderable: MeshRenderable): MeshData
    {
        // TODO could pool these?
        const meshData = new MeshData();

        // if (recordMode)
        // {
        //     const passEncoder = renderer.encoder.startRecording();

        //     this.renderMesh(gpuMesh, renderable, renderer);

        //     gpuMesh.renderBundle = [(passEncoder).finish()];
        // }

        this.gpuMeshDataHash[renderable.uid] = meshData;

        return meshData;
    }

    getBatchableMesh(renderable: MeshRenderable): BatchableMesh
    {
        return this.gpuBatchableMeshHash[renderable.uid] || this.initBatchableMesh(renderable);
    }

    initBatchableMesh(renderable: MeshRenderable): BatchableMesh
    {
        // TODO - make this batchable graphics??
        const gpuMesh: BatchableMesh = new BatchableMesh();

        gpuMesh.renderable = renderable;

        this.gpuBatchableMeshHash[renderable.uid] = gpuMesh;

        gpuMesh.renderable = renderable;
        gpuMesh.texture = renderable.texture;

        renderable.dirty = false;

        return gpuMesh;
    }
}
