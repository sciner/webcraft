import { CanvasSource } from '../sources/CanvasSource.js';
import { Texture } from '../Texture.js';

import type { ICanvas } from '../../../../../settings/adapter/ICanvas.js';
import type { CanvasSourceOptions } from '../sources/CanvasSource.js';

const canvasCache: Map<ICanvas, Texture> = new Map();

export function getCanvasTexture(canvas: ICanvas, options?: CanvasSourceOptions): Texture
{
    if (!canvasCache.has(canvas))
    {
        const texture = new Texture({
            source: new CanvasSource({
                resource: canvas,
                ...options,
            })
        });

        canvasCache.set(canvas, texture);
    }

    return canvasCache.get(canvas);
}
