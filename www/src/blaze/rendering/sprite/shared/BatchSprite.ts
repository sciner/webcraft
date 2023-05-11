import type { BatchableObject, Batcher } from '../../batcher/shared/Batcher.js';
import type { Texture } from '../../renderers/shared/texture/Texture.js';
import type { SpriteRenderable } from './SpriteRenderable.js';

export class BatchableSprite implements BatchableObject
{
    visible: boolean;
    indexStart: number;
    renderable: SpriteRenderable;

    // batch specific..
    vertexSize = 4;
    indexSize = 6;

    texture: Texture;

    textureId: number;
    location = 0; // location in the buffer
    batch: Batcher;
    bounds: [number, number, number, number];

    get blendMode() { return this.renderable.data.worldBlendMode; }

    packAttributes(
        float32View: Float32Array,
        uint32View: Uint32Array,
        index: number,
        textureId: number,
    )
    {
        const renderable = this.renderable;

        const wt = renderable.matrix;

        const a = wt.a;
        const b = wt.b;
        const c = wt.c;
        const d = wt.d;
        const tx = wt.tx;
        const ty = wt.ty;

        const bounds = renderable.bounds;

        const w0 = bounds[0];
        const w1 = bounds[1];
        const h0 = bounds[2];
        const h1 = bounds[3];

        const uvs = renderable._texture._layout.uvs;

        const argb = renderable.data.worldTintAlpha;

        // xy
        float32View[index++] = (a * w1) + (c * h1) + tx;
        float32View[index++] = (d * h1) + (b * w1) + ty;

        float32View[index++] = uvs.x0;// [0];
        float32View[index++] = uvs.y0;// [1];

        uint32View[index++] = argb;
        float32View[index++] = textureId;

        // xy
        float32View[index++] = (a * w0) + (c * h1) + tx;
        float32View[index++] = (d * h1) + (b * w0) + ty;

        float32View[index++] = uvs.x1;// [2];
        float32View[index++] = uvs.y1;// [3];

        uint32View[index++] = argb;
        float32View[index++] = textureId;

        // xy
        float32View[index++] = (a * w0) + (c * h0) + tx;
        float32View[index++] = (d * h0) + (b * w0) + ty;

        float32View[index++] = uvs.x2;
        float32View[index++] = uvs.y2;

        uint32View[index++] = argb;
        float32View[index++] = textureId;

        // xy
        float32View[index++] = (a * w1) + (c * h0) + tx;
        float32View[index++] = (d * h0) + (b * w1) + ty;

        float32View[index++] = uvs.x3;
        float32View[index++] = uvs.y3;

        uint32View[index++] = argb;
        float32View[index++] = textureId;
    }

    packIndex(indexBuffer: Uint32Array, index: number, indicesOffset: number)
    {
        indexBuffer[index++] = indicesOffset + 0;
        indexBuffer[index++] = indicesOffset + 1;
        indexBuffer[index++] = indicesOffset + 2;

        indexBuffer[index++] = indicesOffset + 0;
        indexBuffer[index++] = indicesOffset + 2;
        indexBuffer[index++] = indicesOffset + 3;
    }
}
