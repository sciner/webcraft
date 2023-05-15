import { ExtensionType } from '../../../extensions/Extensions.js';
// import { ColorBlend } from '../../filters/blend-modes/ColorBlend';
// import { ColorBurnBlend } from '../../filters/blend-modes/ColorBurnBlend';
// import { ColorDodgeBlend } from '../../filters/blend-modes/ColorDodgeBlend';
// import { DarkenBlend } from '../../filters/blend-modes/DarkenBlend';
// import { DifferenceBlend } from '../../filters/blend-modes/DifferenceBlend';
// import { DivideBlend } from '../../filters/blend-modes/DivideBlend';
// import { ExclusionBlend } from '../../filters/blend-modes/ExclusionBlend';
// import { HardLightBlend } from '../../filters/blend-modes/HardLightBlend';
// import { HardMixBlend } from '../../filters/blend-modes/HardMixBlend';
// import { LightenBlend } from '../../filters/blend-modes/LightenBlend';
// import { LinearBurnBlend } from '../../filters/blend-modes/LinearBurnBlend';
// import { LinearDodgeBlend } from '../../filters/blend-modes/LinearDodgeBlend';
// import { LinearLightBlend } from '../../filters/blend-modes/LinearLightBlend';
// import { LuminosityBlend } from '../../filters/blend-modes/LuminosityBlend';
// import { NegationBlend } from '../../filters/blend-modes/NegationBlend';
// import { OverlayBlend } from '../../filters/blend-modes/OverlayBlend';
// import { PinLightBlend } from '../../filters/blend-modes/PinLightBlend';
// import { SaturationBlend } from '../../filters/blend-modes/SaturationBlend';
// import { SoftLightBlend } from '../../filters/blend-modes/SoftLightBlend';
// import { SubtractBlend } from '../../filters/blend-modes/SubtractBlend';
// import { VividLightBlend } from '../../filters/blend-modes/VividLightBlend';
import { FilterEffect } from '../../filters/FilterEffect.js';
import { BLEND_MODES } from './state/const.js';
import { State } from './state/State.js';

import type { ExtensionMetadata } from '../../../extensions/Extensions.js';
import type { FilterInstruction } from '../../filters/shared/FilterPipe.js';
import type { Renderer } from '../types.js';
import type { Instruction } from './instructions/Instruction.js';
import type { InstructionSet } from './instructions/InstructionSet.js';
import type { InstructionGenerator, InstructionRunner } from './instructions/RenderPipe.js';
import type { Renderable } from './Renderable.js';

const BLEND_MODE_FILTERS = {};

export interface AdvancedBlendInstruction extends Instruction
{
    type: 'blendMode',
    blendMode: BLEND_MODES,
    activeBlend: Renderable[],
}


export class BlendModePipe implements InstructionRunner<AdvancedBlendInstruction>, InstructionGenerator
{
    /** @ignore */
    static extension: ExtensionMetadata = {
        type: [
            ExtensionType.WebGLRendererPipes,
            ExtensionType.WebGPURendererPipes,
            ExtensionType.CanvasRendererPipes,
        ],
        name: 'blendMode',
    };

    instructionSet: InstructionSet;

    state: State = State.for2d();
    lastBatch: number;

    renderer: Renderer;

    renderableList: Renderable[];
    activeBlendMode: BLEND_MODES;

    isAdvanced = 0;

    filterHash: Record<BLEND_MODES, FilterEffect> = {};

    constructor(renderer: Renderer)
    {
        this.renderer = renderer;
    }

    bind(instructionSet: InstructionSet)
    {
        this.instructionSet = instructionSet;
    }

    setBlendMode(renderable: Renderable, blendMode: BLEND_MODES)
    {
        if (this.activeBlendMode === blendMode)
        {
            if (this.isAdvanced)
            {
                this.renderableList.push(renderable);
            }

            return;
        }

        this.activeBlendMode = blendMode;

        if (this.isAdvanced)
        {
            this.endAdvancedBlendMode();
        }

        this.isAdvanced = (blendMode & 0b11110000);

        if (this.isAdvanced)
        {
            this.beginAdvancedBlendMode();

            this.renderableList.push(renderable);
        }
    }

    beginAdvancedBlendMode()
    {
        this.renderer.renderPipes.batch.break();

        const blendMode = this.activeBlendMode;

        if (!BLEND_MODE_FILTERS[blendMode])
        {
            console.warn(`Unable to assign 'BLEND_MODES.${BLEND_MODES[blendMode]}' using the blend mode pipeline`);

            return;
        }

        // this does need an execute?
        if (!this.filterHash[blendMode])
        {
            this.filterHash[blendMode] = new FilterEffect({
                filters: [new BLEND_MODE_FILTERS[blendMode]()]
            });
        }

        const instruction: FilterInstruction = {
            type: 'filter',
            action: 'pushFilter',
            renderables: [],
            filterEffect: this.filterHash[blendMode],
            canBundle: false,
        };

        this.renderableList = instruction.renderables;
        this.instructionSet.addInstruction(instruction);
    }

    endAdvancedBlendMode()
    {
        this.renderableList = null;
        this.renderer.renderPipes.batch.break();

        this.instructionSet.addInstruction({
            type: 'filter',
            action: 'popFilter',
            canBundle: false,
        });
    }

    buildStart()
    {
        this.isAdvanced = 0;
    }

    buildEnd()
    {
        if (this.isAdvanced)
        {
            this.endAdvancedBlendMode();
        }
    }
}
