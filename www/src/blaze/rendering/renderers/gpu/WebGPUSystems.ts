// RenderSystems
import { GpuBatchAdaptor } from '../../batcher/gpu/GpuBatchAdaptor.js';
import { GpuFilterAdapter } from '../../filters/gpu/GpuFilterAdapter.js';
import { GpuGraphicsAdaptor } from '../../graphics/gpu/GpuGraphicsAdaptor.js';
import { GpuScissorMaskPipe } from '../../mask/gpu/GpuScissorMaskPipe.js';
import { GpuMeshAdapter } from '../../mesh/gpu/GpuMeshAdapter.js';
import { UniformBatchPipe } from '../shared/instructions/UniformBatchPipe.js';
import { BindGroupSystem } from './BindGroupSystem.js';
import { BufferSystem } from './buffer/GpuBufferSystem.js';
import { GpuBundleSystem } from './GpuBundleSystem.js';
import { GpuColorMaskSystem } from './GpuColorMaskSystem.js';
import { GpuDeviceSystem } from './GpuDeviceSystem.js';
import { GpuEncoderSystem } from './GpuEncoderSystem.js';
import { GpuGlobalUniformPipe } from './GpuGlobalUniformPipe.js';
import { GpuStencilSystem } from './GpuStencilSystem.js';
import { PipelineSystem } from './pipeline/PipelineSystem.js';
import { GpuRenderTargetSystem } from './renderTarget/GpuRenderTargetSystem.js';
import { GpuShaderSystem } from './shader/GpuShaderSystem.js';
import { GpuStateSystem } from './state/GpuStateSystem.js';
import { GpuTextureSystem } from './texture/GpuTextureSystem.js';

import type { SharedRenderPipes, SharedRenderSystems } from '../shared/system/SharedSystems.js';

export interface GPURenderSystems extends SharedRenderSystems, PixiMixins.GPURenderSystems
{
    device: GpuDeviceSystem,
    buffer: BufferSystem,
    texture: GpuTextureSystem,
    renderTarget: GpuRenderTargetSystem,
    encoder: GpuEncoderSystem,
    shader: GpuShaderSystem,
    state: GpuStateSystem,
    pipeline: PipelineSystem,
    bundle: GpuBundleSystem,
    colorMask: GpuColorMaskSystem,
    stencil: GpuStencilSystem,
    bindGroup: BindGroupSystem,
}

export interface GPURenderPipes extends SharedRenderPipes, PixiMixins.GPURenderPipes
{
    uniformBatch: UniformBatchPipe,
    scissorMask: GpuScissorMaskPipe,
    globalUniforms: GpuGlobalUniformPipe,
}

export const WebGPUSystemsExtensions = [
    GpuDeviceSystem,
    BufferSystem,
    GpuTextureSystem,
    GpuRenderTargetSystem,
    GpuEncoderSystem,
    GpuShaderSystem,
    GpuStateSystem,
    PipelineSystem,
    GpuBundleSystem,
    GpuColorMaskSystem,
    GpuStencilSystem,
    BindGroupSystem,
    // Pipes
    UniformBatchPipe,
    GpuScissorMaskPipe,
    GpuGlobalUniformPipe,
    // Adapters
    GpuBatchAdaptor,
    GpuMeshAdapter,
    GpuGraphicsAdaptor,
    GpuFilterAdapter,
];
