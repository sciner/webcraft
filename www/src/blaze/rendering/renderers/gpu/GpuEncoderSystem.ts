import { ExtensionType } from '../../../extensions/Extensions.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { Rectangle } from '../../../maths/shapes/Rectangle.js';
import type { Bounds } from '../../scene/bounds/Bounds.js';
import type { Topology } from '../shared/geometry/const.js';
import type { Geometry } from '../shared/geometry/Geometry.js';
import type { RenderTarget } from '../shared/renderTarget/RenderTarget.js';
import type { Shader } from '../shared/shader/Shader.js';
import type { State } from '../shared/state/State.js';
import type { ISystem } from '../shared/system/ISystem.js';
import type { GpuRenderTarget } from './renderTarget/GpuRenderTarget.js';
import type { BindGroup } from './shader/BindGroup.js';
import type { GpuProgram } from './shader/GpuProgram.js';
import type { WebGPURenderer } from './WebGPURenderer.js';

export class GpuEncoderSystem implements ISystem
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGPURendererSystem,
        ],
        name: 'encoder',
    };
    boundBindGroup: Record<number, BindGroup> = {};
    boundVertexBuffer: Record<number, Buffer> = {};
    boundIndexBuffer: Buffer;
    boundPipeline: GPURenderPipeline;

    renderer: WebGPURenderer;
    commandEncoder: GPUCommandEncoder;
    renderPassEncoder: GPURenderPassEncoder;

    gpu: GPU;

    commandFinished: Promise<void>;
    resolveCommandFinished: (value: void) => void;

    constructor(renderer: WebGPURenderer)
    {
        this.renderer = renderer;
    }

    start(): void
    {
        this.commandFinished = new Promise((resolve) =>
        {
            this.resolveCommandFinished = resolve;
        });

        // generate a render pass description..
        // create an encoder..
        this.commandEncoder = this.renderer.gpu.device.createCommandEncoder();
    }

    protected contextChange(gpu: GPU): void
    {
        this.gpu = gpu;
    }

    beginRenderPass(renderTarget: RenderTarget, gpuRenderTarget: GpuRenderTarget)
    {
        // TODO we should not finish a render pass each time we bind
        // for example filters - we would want to push / pop render targets
        if (this.renderPassEncoder)
        {
            this.renderPassEncoder.end();
        }

        this.clearCache();

        this.renderPassEncoder = this.commandEncoder.beginRenderPass(gpuRenderTarget.descriptor);

        this.setViewport(renderTarget.viewport);
    }

    setViewport(viewport: Rectangle): void
    {
        this.renderPassEncoder.setViewport(
            viewport.x,
            viewport.y,
            viewport.width,
            viewport.height,
            0, 1);
    }

    setScissor(bounds: Bounds): void
    {
        bounds.fit(this.renderer.renderTarget.renderTarget.viewport);

        this.renderPassEncoder.setScissorRect(
            bounds.minX,
            bounds.minY,
            bounds.width,
            bounds.height
        );
    }

    clearScissor(): void
    {
        const viewport = this.renderer.renderTarget.renderTarget.viewport;

        this.renderPassEncoder.setScissorRect(
            viewport.x,
            viewport.y,
            viewport.width,
            viewport.height
        );
    }

    setPipelineFromGeometryProgramAndState(geometry: Geometry, program: GpuProgram, state: any, topology?: Topology): void
    {
        const pipeline = this.renderer.pipeline.getPipeline(geometry, program, state, topology);

        this.setPipeline(pipeline);
    }

    setPipeline(pipeline: GPURenderPipeline)
    {
        if (this.boundPipeline === pipeline) return;
        this.boundPipeline = pipeline;

        this.renderPassEncoder.setPipeline(pipeline);
    }

    setVertexBuffer(index: number, buffer: Buffer)
    {
        if (this.boundVertexBuffer[index] === buffer) return;

        this.boundVertexBuffer[index] = buffer;

        this.renderPassEncoder.setVertexBuffer(
            index,
            this.renderer.buffer.updateBuffer(buffer),
        );
    }

    setIndexBuffer(buffer: Buffer)
    {
        if (this.boundIndexBuffer === buffer) return;

        this.boundIndexBuffer = buffer;

        this.renderPassEncoder.setIndexBuffer(
            this.renderer.buffer.updateBuffer(buffer),
            'uint32',
        );
    }

    setBindGroup(index: number, bindGroup: BindGroup, program: GpuProgram)
    {
        if (this.boundBindGroup[index] === bindGroup) return;
        this.boundBindGroup[index] = bindGroup;

        // TODO or is dirty!
        const gpuBindGroup = this.renderer.bindGroup.getBindGroup(bindGroup, program, index);

        this.renderPassEncoder.setBindGroup(index, gpuBindGroup);
    }

    setGeometry(geometry: Geometry)
    {
        for (const i in geometry.attributes)
        {
            const attribute = geometry.attributes[i];

            this.setVertexBuffer(attribute.shaderLocation, attribute.buffer);
        }

        if (geometry.indexBuffer)
        {
            this.setIndexBuffer(geometry.indexBuffer);
        }
    }

    setShaderBindGroups(shader: Shader, skipSync?: boolean)
    {
        for (const i in shader.groups)
        {
            const bindGroup = shader.groups[i] as BindGroup;

            // update any uniforms?
            if (!skipSync)
            {
                this.syncBindGroup(bindGroup);
            }

            this.setBindGroup(i, bindGroup, shader.gpuProgram);
        }
    }

    syncBindGroup(bindGroup: BindGroup)
    {
        for (const j in bindGroup.resources)
        {
            const resource = bindGroup.resources[j];

            if (resource.group)
            {
                this.renderer.uniformBuffer.updateUniformGroup(resource);
            }
        }
    }

    draw(options: {
        geometry: Geometry,
        shader: Shader,
        state?: State,
        topology?: Topology,
        size?: number,
        start?: number,
        instanceCount?: number
        skipSync?: boolean,
    })
    {
        const { geometry, shader, state, topology, size, start, instanceCount, skipSync } = options;

        this.setPipelineFromGeometryProgramAndState(geometry, shader.gpuProgram, state, topology);
        this.setGeometry(geometry);
        this.setShaderBindGroups(shader, skipSync);

        if (geometry.indexBuffer)
        {
            this.renderPassEncoder.drawIndexed(size || geometry.indexBuffer.data.length, instanceCount || 1, start || 0);
        }
        else
        {
            this.renderPassEncoder.draw(size || geometry.getSize(), instanceCount || 1, start || 0);
        }
    }

    finishRenderPass()
    {
        if (this.renderPassEncoder)
        {
            this.renderPassEncoder.end();
            this.renderPassEncoder = null;
        }
    }

    finish()
    {
        this.finishRenderPass();

        this.gpu.device.queue.submit([this.commandEncoder.finish()]);

        this.resolveCommandFinished();
    }

    // restores a render pass if finishRenderPass was called
    // not optimised as really used for debugging!
    // used when we want to stop drawing and log a texture..
    restoreRenderPass()
    {
        const descriptor = this.renderer.renderTarget.getDescriptor(
            this.renderer.renderTarget.renderTarget,
            false,
            [0, 0, 0, 1]
        );

        this.renderPassEncoder = this.commandEncoder.beginRenderPass(descriptor);

        const boundPipeline = this.boundPipeline;
        const boundVertexBuffer = { ...this.boundVertexBuffer };
        const boundIndexBuffer = this.boundIndexBuffer;
        const boundBindGroup = { ...this.boundBindGroup };

        this.clearCache();

        const viewport = this.renderer.renderTarget.renderTarget.viewport;

        this.renderPassEncoder.setViewport(
            viewport.x,
            viewport.y,
            viewport.width,
            viewport.height,
            0, 1);

        // reinstate the cache...

        this.setPipeline(boundPipeline);

        let i: number;

        for (i in boundVertexBuffer)
        {
            this.setVertexBuffer(i, boundVertexBuffer[i]);
        }

        for (i in boundBindGroup)
        {
            this.setBindGroup(i, boundBindGroup[i], null);
        }

        this.setIndexBuffer(boundIndexBuffer);
    }

    clearCache()
    {
        for (let i = 0; i < 16; i++)
        {
            this.boundBindGroup[i] = null;
            this.boundVertexBuffer[i] = null;
        }

        this.boundIndexBuffer = null;
        this.boundPipeline = null;
    }
}
