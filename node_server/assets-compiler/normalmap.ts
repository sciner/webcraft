import skiaCanvas from 'skia-canvas';
import { Vector } from '../../www/src/helpers.js';

/**
 * 
 * @param {*} scanva
 * @param {int} sprite_width
 * @param {int} sprite_height
 * @returns 
 */
export function  generateNormalMap(scanva, sprite_width, sprite_height) {

    const width     = scanva.width
    const height    = scanva.height
    const sctx      = scanva.getContext('2d');
    const imageData = sctx.getImageData(0, 0, width, height)
    const pixs      = imageData.data

    // Generate normal map
    const new_pixs = normal_from_height(pixs, 1.5, sprite_width, sprite_height, sprite_width, sprite_height)

    // Copy result to source
    let idx = 0
    for(let x = 0; x < width; x++) {
        for(let y = 0; y < height; y++) {
            pixs[idx + 0] = new_pixs[idx + 0] || 128
            pixs[idx + 1] = new_pixs[idx + 1] || 128
            pixs[idx + 2] = new_pixs[idx + 2] || 255
            pixs[idx + 3] = 255
            idx += 4
        }
    }

    // Result
    const result = new skiaCanvas.Canvas(width, height)
    result.ctx = result.getContext('2d')
    result.ctx.imageSmoothingEnabled = false
    result.ctx.putImageData(imageData, 0, 0)
    return result

}

/**
 * Pixel
 */
class Pixel {

    /**
     * @param {int} r 
     * @param {int} g 
     * @param {int} b 
     */
    constructor(r, g, b) {
        this.red = r
        this.green = g
        this.blue = b
    }

}

/**
 * Determine intensity of pixel, from 0 - 1
 * 
 * @param {Pixel} pPixel
 * 
 * @returns {float}
 */
function intensity(pPixel) {
    const r = pPixel.red;
    const g = pPixel.green;
    const b = pPixel.blue;
    const average = (r + g + b) / 3.0
    return average / 255.0
}

/**
 * @param {int} pX 
 * @param {int} pMin 
 * @param {int} pMax 
 * @returns 
 */
function clamp(pX, pMin, pMax) {
    if (pX > pMax) {
        return pMax;
    } else if (pX < pMin) {
        return pMin
    }
    return pX
}

/**
 * transform -1 - 1 to 0 - 255
 * @param {float} pX 
 * @returns {int}
 */
function map_component(pX) {
    return (pX + 1.0) * (255.0 / 2.0);
}

/**
 * @param {*} pixs 
 * @param {float} pStrength
 * @param {int} width
 * @param {int} height
 * @param {int} sprite_width
 * @param {int} sprite_height
 * 
 * @returns {Uint8Array}
 */
function normal_from_height(pixs, pStrength = 2.0, width, height, sprite_width, sprite_height) {

    const result = new Uint8Array(width * height * 4)

    const getPixel = (x, y) => {
        const index = (y * width + x) * 4
        return new Pixel(pixs[index + 0], pixs[index + 1], pixs[index + 2])
    }

    for(let x = 0; x < width; ++x) {
        for(let y = 0; y < height; ++y) {

            const minx = Math.floor(x / sprite_width) * sprite_width
            const miny = Math.floor(y / sprite_height) * sprite_height
            const maxx = minx + sprite_width - 1
            const maxy = miny + sprite_height - 1

            // surrounding pixels
            const topLeft = getPixel(clamp(x - 1, minx, maxx), clamp(y - 1, miny, maxy))
            const top = getPixel(clamp(x, minx, maxx), clamp(y - 1, miny, maxy))
            const topRight = getPixel(clamp(x + 1, minx, maxx), clamp(y - 1, miny, maxy))
            const right = getPixel(clamp(x + 1, minx, maxx), clamp(y, miny, maxy))
            const bottomRight = getPixel(clamp(x + 1, minx, maxx), clamp(y + 1, miny, maxy))
            const bottom = getPixel(clamp(x, minx, maxx), clamp(y + 1, miny, maxy))
            const bottomLeft = getPixel(clamp(x - 1, minx, maxx), clamp(y + 1, miny, maxy))
            const left = getPixel(clamp(x - 1, minx, maxx), clamp(y, miny, maxy))

            // their intensities
            const tl = intensity(topLeft)
            const t = intensity(top)
            const tr = intensity(topRight)
            const r = intensity(right)
            const br = intensity(bottomRight)
            const b = intensity(bottom)
            const bl = intensity(bottomLeft)
            const l = intensity(left)

            // sobel filter
            const dX = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
            const dY = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);
            const dZ = 1.0 / pStrength;

            const v = new Vector(dX, dY, dZ).normalize()

            // convert to rgb
            const index = (y * width + x) * 4
            result[index + 0] = map_component(v.x)
            result[index + 1] = map_component(v.y)
            result[index + 2] = map_component(v.z)

        }
    }

    return result

}