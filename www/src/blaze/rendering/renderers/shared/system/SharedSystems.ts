import { TilingSpritePipe } from '../../../../tiling-sprite/TilingSpritePipe';
import { BatcherPipe } from '../../../batcher/shared/BatcherPipe';
import { FilterPipe } from '../../../filters/shared/FilterPipe';
import { GraphicsContextSystem } from '../../../graphics/shared/GraphicsContextSystem';
import { GraphicsPipe } from '../../../graphics/shared/GraphicsPipe';
import { AlphaMaskPipe } from '../../../mask/shared/AlphaMaskPipe';
import { ColorMaskPipe } from '../../../mask/shared/ColorMaskPipe';
import { StencilMaskPipe } from '../../../mask/shared/StencilMaskPipe';
import { MeshPipe } from '../../../mesh/shared/MeshPipe';
import { BuilderSystem } from '../../../scene/BuilderSystem';
import { ContainerSystem } from '../../../scene/ContainerSystem';
import { TransformSystem } from '../../../scene/TransformSystem';
import { SpritePipe } from '../../../sprite/shared/SpritePipe';
import { SpriteSystem } from '../../../sprite/shared/SpriteSystem';
import { BitmapTextPipe } from '../../../text/bitmap/BitmapTextPipe';
import { CanvasTextPipe } from '../../../text/canvas/CanvasTextPipe';
import { CanvasTextSystem } from '../../../text/canvas/CanvasTextSystem';
import { GpuGlobalUniformPipe } from '../../gpu/GpuGlobalUniformPipe';
import { BackgroundSystem } from '../background/BackgroundSystem';
import { BlendModePipe } from '../BlendModePipe';
import { InstructionPipe } from '../instructions/InstructionPipe';
import { InstructionSystem } from '../instructions/InstructionSystem';
import { GlobalUniformSystem } from '../renderTarget/GlobalUniformSystem';
import { UniformBufferSystem } from '../shader/UniformBufferSystem';
import { StartupSystem } from '../startup/StartupSystem';
import { TexturePoolSystem } from '../texture/TexturePoolSystem';
import { ViewSystem } from '../view/ViewSystem';

import type { BackgroundSystemOptions } from '../background/BackgroundSystem';
import type { StartupSystemOptions } from '../startup/StartupSystem';
import type { ViewSystemOptions } from '../view/ViewSystem';

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
    graphicsContext: GraphicsContextSystem,
    canvasText: CanvasTextSystem,
}

export interface SharedRenderPipes extends PixiMixins.SharedRenderPipes
{
    blendMode: BlendModePipe,
    batch: BatcherPipe,
    mesh: MeshPipe,
    sprite: SpritePipe,
    tilingSprite: TilingSpritePipe,
    alphaMask: AlphaMaskPipe,
    stencilMask: StencilMaskPipe,
    colorMask: ColorMaskPipe,
    graphics: GraphicsPipe,
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
    GraphicsContextSystem,
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
    GraphicsPipe,
    BlendModePipe,
    InstructionPipe,
    AlphaMaskPipe,
    ColorMaskPipe,
    StencilMaskPipe,
    MeshPipe,
    SpritePipe,
    TilingSpritePipe,
    BitmapTextPipe,
    CanvasTextPipe,
    GpuGlobalUniformPipe,
];
