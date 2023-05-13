import { Point } from '../../../maths/Point.js';
import { Polygon } from '../../../maths/shapes/Polygon.js';
import { NOOP } from '../../../utils/NOOP.js';
import { Bounds } from '../../scene/bounds/Bounds.js';
import { getGlobalRenderableBounds } from '../../scene/bounds/getRenderableBounds.js';

import type { Matrix } from '../../../maths/Matrix.js';
import type { PointData } from '../../../maths/PointData.js';
import type { Instruction } from '../../renderers/shared/instructions/Instruction.js';
import type { InstructionSet } from '../../renderers/shared/instructions/InstructionSet.js';
import type { Renderable, RenderableData } from '../../renderers/shared/Renderable.js';
import type { Shader } from '../../renderers/shared/shader/Shader.js';
import type { Texture } from '../../renderers/shared/texture/Texture.js';
import type { MeshGeometry } from './MeshGeometry.js';
import type { MeshShader } from './MeshShader.js';

let UID = 0;

const tempPolygon = new Polygon();
const tempBounds = new Bounds();

export interface MeshRenderableTextureOptions
{
    geometry: MeshGeometry;
    texture: Texture;
    renderableData: RenderableData
}

export interface MeshRenderableShaderOptions
{
    geometry: MeshGeometry;
    shader: Shader;
    renderableData: RenderableData
}

export type MeshRenderableOptions = MeshRenderableTextureOptions | MeshRenderableShaderOptions;

export class MeshRenderable<GEOMETRY extends MeshGeometry = MeshGeometry>implements Renderable, Instruction
{
    uid: number = UID++;
    matrix: Matrix;

    type = 'mesh';
    _texture: Texture;

    _geometry: GEOMETRY;

    // TODO this should be a shader type! As long as its compatible!
    _shader?: MeshShader;

    onRenderableUpdate = NOOP;
    instructionSet: InstructionSet;
    renderableUpdateRequested: boolean;

    visible = true;
    updateTick = -1;
    canBundle = true;
    data: RenderableData;
    action?: string;
    buildId: number;

    dirty = true;

    constructor(options: MeshRenderableOptions)
    {
        this.shader = (options as any).shader;

        if ((options as any).texture)
        {
            this.texture = (options as any).texture;
        }

        this.data = options.renderableData;
        this.matrix = options.renderableData.worldTransform;

        this._geometry = options.geometry as any;
        this._geometry.onUpdate.add(this);
        this.onRenderableUpdate();
    }

    set shader(value: MeshShader)
    {
        if (this._shader === value) return;

        this._shader = value;

        this.onChange();
    }

    get shader()
    {
        return this._shader;
    }

    set geometry(value: GEOMETRY)
    {
        if (this._geometry === value) return;

        this._geometry?.onUpdate.remove(this);
        value.onUpdate.add(this);

        this._geometry = value;

        this.onChange();
    }

    get geometry()
    {
        return this._geometry;
    }

    set texture(value: Texture)
    {
        if (this._texture === value) return;

        this.onRenderableUpdate();

        if (this._texture)
        {
            this.shader.resources.uTexture = value.source;
            this.shader.resources.uSampler = value.style;
        }

        this._texture = value;
    }

    get texture()
    {
        return this._texture;
    }

    addBounds(bounds: Bounds)
    {
        bounds.addVertexData(this.geometry.positions, 0, this.geometry.positions.length);
    }

    containsPoint(point: PointData)
    {
        const res = getGlobalRenderableBounds([this], tempBounds);
        // TODO: we should cache the bounds

        if (!res.rectangle.contains(point.x, point.y))
        {
            return false;
        }

        const position = this.data.worldTransform.applyInverse(point, Point.shared);

        const vertices = this.geometry.getBuffer('aVertexPosition').data;

        const points = tempPolygon.points;
        const indices = this.geometry.getIndex().data;
        const len = indices.length;
        const step = this.geometry.topology === 'triangle-strip' ? 3 : 1;

        for (let i = 0; i + 2 < len; i += step)
        {
            const ind0 = indices[i] * 2;
            const ind1 = indices[i + 1] * 2;
            const ind2 = indices[i + 2] * 2;

            points[0] = vertices[ind0];
            points[1] = vertices[ind0 + 1];
            points[2] = vertices[ind1];
            points[3] = vertices[ind1 + 1];
            points[4] = vertices[ind2];
            points[5] = vertices[ind2 + 1];

            if (tempPolygon.contains(position.x, position.y))
            {
                return true;
            }
        }

        return false;
    }

    get batched()
    {
        if (this.shader) return false;

        if (this.geometry.batchMode === 'auto')
        {
            return this.geometry.positions.length / 2 <= 100;
        }

        return this.geometry.batchMode === 'batch';
    }

    onGeometryUpdate()
    {
        this.onChange();
    }

    onChange()
    {
        if (this.dirty) return;

        this.dirty = true;

        this.onRenderableUpdate();
    }
}
