export function colorToUniform(rgb: number, alpha: number, out: Float32Array, offset: number)
{
    // TODO replace with Color..
    out[offset++] = ((rgb >> 16) & 0xFF) / 255;
    out[offset++] = ((rgb >> 8) & 0xFF) / 255;
    out[offset++] = (rgb & 0xFF) / 255;
    out[offset++] = alpha;
}
