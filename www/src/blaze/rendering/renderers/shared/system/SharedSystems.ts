// import { TilingSpritePipe } from '../../../../tiling-sprite/TilingSpritePipe.js';
import { BatcherPipe } from '../../../batcher/shared/BatcherPipe.js';
import { FilterPipe } from '../../../filters/shared/FilterPipe.js';
// import { GraphicsContextSystem } from '../../../graphics/shared/GraphicsContextSystem.js';
// import { GraphicsPipe } from '../../../graphics/shared/GraphicsPipe.js';
import { AlphaMaskPipe } from '../../../mask/shared/AlphaMaskPipe.js';
import { ColorMaskPipe } from '../../../mask/shared/ColorMaskPipe.js';
import { StencilMaskPipe } from '../../../mask/shared/StencilMaskPipe.js';
import { MeshPipe } from '../../../mesh/shared/MeshPipe.js';
import { BuilderSystem } from '../../../scene/BuilderSystem.js';
import { ContainerSystem } from '../../../scene/ContainerSystem.js';
import { TransformSystem } from '../../../scene/TransformSystem.js';
import { SpritePipe } from '../../../sprite/shared/SpritePipe.js';
import { SpriteSystem } from '../../../sprite/shared/SpriteSystem.js';
import { BitmapTextPipe } from '../../../text/bitmap/BitmapTextPipe.js';
import { CanvasTextPipe } from '../../../text/canvas/CanvasTextPipe.js';
import { CanvasTextSystem } from '../../../text/canvas/CanvasTextSystem.js';
import { GpuGlobalUniformPipe } from '../../gpu/GpuGlobalUniformPipe.js';
import { BackgroundSystem } from '../background/BackgroundSystem.js';
import { BlendModePipe } from '../BlendModePipe.js';
import { InstructionPipe } from '../instructions/InstructionPipe.js';
import { InstructionSystem } from '../instructions/InstructionSystem.js';
import { GlobalUniformSystem } from '../renderTarget/GlobalUniformSystem.js';
import { UniformBufferSystem } from '../shader/UniformBufferSystem.js';
import { StartupSystem } from '../startup/StartupSystem.js';
import { TexturePoolSystem } from '../texture/TexturePoolSystem.js';
import { ViewSystem } from '../view/ViewSystem.js';

import type { BackgroundSystemOptions } from '../background/BackgroundSystem.js';
import type { StartupSystemOptions } from '../startup/StartupSystem.js';
import type { ViewSystemOptions } from '../view/ViewSystem.js';

export interface SharedRenderSystems extends PixiMixins.SharedRenderSystems
{
    view: ViewSystem,
    startup: StartupSystem,
    background: BackgroundSystem,
    uniformBuffer: UniformBufferSystem,
    instructions: InstructionSystem,
    container: ContainerSystem,
    transform: TransformSystem,
    builder: BuilderSystem,
    texturePool: TexturePoolSystem,
    globalUniforms: GlobalUniformSystem,
    sprite: SpriteSystem,
    // graphicsContext: GraphicsContextSystem,
    canvasText: CanvasTextSystem,
}

export interface SharedRenderPipes extends PixiMixins.SharedRenderPipes
{
    blendMode: BlendModePipe,
    batch: BatcherPipe,
    mesh: MeshPipe,
    sprite: SpritePipe,
    // tilingSprite: TilingSpritePipe,
    alphaMask: AlphaMaskPipe,
    stencilMask: StencilMaskPipe,
    colorMask: ColorMaskPipe,
    // graphics: GraphicsPipe,
    text: CanvasTextPipe,
    bitmapText: BitmapTextPipe,
    filter: FilterPipe,
    instruction: InstructionPipe,
    globalUniforms: GpuGlobalUniformPipe,
}

export type RenderSystems<T extends Record<string, any>> = SharedRenderSystems & {
    [K in keyof T]: InstanceType<T[K]>;
};

export type RenderPipes<T extends Record<string, any>> = SharedRenderPipes & {
    [K in keyof T]: InstanceType<T[K]>;
};

export interface SharedRendererOptions extends PixiMixins.SharedRendererOptions, BackgroundSystemOptions,
    ViewSystemOptions,
    StartupSystemOptions
{}

export const SharedDefaultRendererOptions = {
    ...BackgroundSystem.defaultOptions,
    ...ViewSystem.defaultOptions,
    ...StartupSystem.defaultOptions
};

export const SharedRendererExtensions = [
    // GraphicsContextSystem,
    BackgroundSystem,
    InstructionSystem,
    GlobalUniformSystem,
    UniformBufferSystem,
    StartupSystem,
    TexturePoolSystem,
    ViewSystem,
    BuilderSystem,
    ContainerSystem,
    TransformSystem,
    SpriteSystem,
    CanvasTextSystem,
    // Render Pipes
    BatcherPipe,
    FilterPipe,
    // GraphicsPipe,
    BlendModePipe,
    InstructionPipe,
    AlphaMaskPipe,
    ColorMaskPipe,
    StencilMaskPipe,
    MeshPipe,
    SpritePipe,
    // TilingSpritePipe,
    BitmapTextPipe,
    CanvasTextPipe,
    GpuGlobalUniformPipe,
];
