import type { TextureSource } from '../../shared/texture/sources/TextureSource.js';

export class GpuRenderTarget
{
    contexts: GPUCanvasContext[] = [];
    msaaTextures: TextureSource[] = [];
    msaa: boolean;
    msaaSamples = 1;
    width: number;
    height: number;
    descriptor: GPURenderBundleDescriptor;
}
