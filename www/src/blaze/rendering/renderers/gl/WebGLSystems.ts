import { GlBatchAdaptor } from '../../batcher/gl/GlBatchAdaptor.js';
import { GlFilterAdaptor } from '../../filters/gl/GlFilterAdaptor.js';
import { GlGraphicsAdaptor } from '../../graphics/gl/GlGraphicsAdaptor.js';
import { GlMeshAdaptor } from '../../mesh/gl/GlMeshAdaptor.js';
import { GlBufferSystem } from './buffer/GlBufferSystem.js';
import { GlContextSystem } from './context/GlContextSystem.js';
import { GlGeometrySystem } from './geometry/GlGeometrySystem.js';
import { GlBackBufferSystem } from './GlBackBufferSystem.js';
import { GlColorMaskSystem } from './GlColorMaskSystem.js';
import { GlEncoderSystem } from './GlEncoderSystem.js';
import { GlRenderTargetSystem } from './GlRenderTargetSystem.js';
import { GlStencilSystem } from './GlStencilSystem.js';
import { GlShaderSystem } from './shader/GlShaderSystem.js';
import { GlUniformGroupSystem } from './shader/GlUniformGroupSystem.js';
import { GlStateSystem } from './state/GlStateSystem.js';
import { GlTextureSystem } from './texture/GlTextureSystem.js';

import type { SharedRenderPipes, SharedRenderSystems } from '../shared/system/SharedSystems.js';

export interface GLRenderSystems extends SharedRenderSystems, PixiMixins.GLRenderSystems
{
    backBuffer: GlBackBufferSystem,
    context: GlContextSystem,
    buffer: GlBufferSystem,
    texture: GlTextureSystem,
    renderTarget: GlRenderTargetSystem,
    geometry: GlGeometrySystem,
    uniformGroup: GlUniformGroupSystem,
    shader: GlShaderSystem,
    encoder: GlEncoderSystem,
    state: GlStateSystem,
    stencil: GlStencilSystem,
    colorMask: GlColorMaskSystem,
}

export interface GLRenderPipes extends SharedRenderPipes, PixiMixins.GLRenderPipes
{}

export const WebGLSystemExtensions = [
    GlBackBufferSystem,
    GlContextSystem,
    GlBufferSystem,
    GlTextureSystem,
    GlRenderTargetSystem,
    GlGeometrySystem,
    GlUniformGroupSystem,
    GlShaderSystem,
    GlEncoderSystem,
    GlStateSystem,
    GlStencilSystem,
    GlColorMaskSystem,
    // Pipes

    // Adapters
    GlBatchAdaptor,
    GlMeshAdaptor,
    GlGraphicsAdaptor,
    GlFilterAdaptor,
];
