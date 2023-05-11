import type { BatchableObject, Batcher } from '../../batcher/shared/Batcher.js';
import type { Texture } from '../../renderers/shared/texture/Texture.js';
import type { MeshRenderable } from './MeshRenderable.js';

export class BatchableMesh implements BatchableObject
{
    visible: boolean;
    indexStart: number;
    textureId: number;
    texture: Texture;
    location: number;
    batch: Batcher;
    renderable: MeshRenderable;

    get blendMode() { return this.renderable.data.worldBlendMode; }

    packIndex(indexBuffer: Uint32Array, index: number, indicesOffset: number)
    {
        const indices = this.renderable.geometry.indices;

        for (let i = 0; i < indices.length; i++)
        {
            indexBuffer[index++] = indices[i] + indicesOffset;
        }
    }

    packAttributes(
        float32View: Float32Array,
        uint32View: Uint32Array,
        index: number,
        textureId: number
    )
    {
        const renderable = this.renderable;

        const geometry = this.renderable.geometry;

        const wt = renderable.matrix;

        // wt.toArray(true);
        const a = wt.a;
        const b = wt.b;
        const c = wt.c;
        const d = wt.d;
        const tx = wt.tx;
        const ty = wt.ty;

        // const trim = texture.trim;
        const positions = geometry.positions;
        const uvs = geometry.uvs;

        const argb = renderable.data.worldTintAlpha;

        for (let i = 0; i < positions.length; i += 2)
        {
            const x = positions[i];
            const y = positions[i + 1];

            float32View[index++] = (a * x) + (c * y) + tx;
            float32View[index++] = (b * x) + (d * y) + ty;

            // TODO implement texture matrix?
            float32View[index++] = uvs[i];
            float32View[index++] = uvs[i + 1];

            uint32View[index++] = argb;
            float32View[index++] = textureId;
        }
    }

    get vertexSize()
    {
        return this.renderable.geometry.positions.length / 2;
    }

    get indexSize()
    {
        return this.renderable.geometry.indices.length;
    }
}
