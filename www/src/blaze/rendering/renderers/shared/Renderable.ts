import type { Matrix } from '../../../maths/Matrix';
import type { Point } from '../../../maths/Point';
import type { Bounds } from '../../scene/bounds/Bounds';
import type { InstructionSet } from './instructions/InstructionSet';
import type { BLEND_MODES } from './state/const';

export interface RenderableData
{
    worldTransform: Matrix;
    worldTint: number;
    worldAlpha: number;
    worldTintAlpha: number;
    worldBlendMode: BLEND_MODES;
}
export interface Renderable
{
    uid: number;

    data: RenderableData

    visible: boolean;

    buildId: number;

    batched: boolean;

    /**
     * an identifier that is used to identify the type of system that will be used to render this renderable
     * eg, 'sprite' will use the sprite system (based on the systems name
     */
    type: string;

    /** used to let us know if the renderable update has been requested managed by the instruction set and its system */
    renderableUpdateRequested: boolean;
    /** the instruction set that owns this renderable, a renderable an only be used once in the render pass */
    instructionSet: InstructionSet;

    onRenderableUpdate: () => void;

    addBounds: (bounds: Bounds) => void;
    containsPoint: (point: Point) => boolean;
}
