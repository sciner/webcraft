import type { Matrix } from '../../../maths/Matrix.js';
import type { Texture } from '../../renderers/shared/texture/Texture.js';

export function getTextureDefaultMatrix(texture: Texture, out: Matrix): Matrix
{
    const { frameWidth, frameHeight } = texture;

    out.scale(1 / frameWidth, 1 / frameHeight);

    return out;
}
