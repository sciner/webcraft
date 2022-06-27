import {AlphabetTexture, QUAD_FLAGS, Vector} from '../helpers.js';
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
/**
 * @typedef {object} CharUV
 * @property {number} width - width
 * @property {number} height - height 
 * @property {number} xadvance
 * @property {number} yoffset
 * @property {number} x - x
 * @property {number} y - y
 * @property {string} char - char
 * 
 */

/**
 * @typedef {object} Char
 * @property {number} width - normalised width
 * @property {number} height - normalised height 
 * @property {number} xn - normalised x
 * @property {number} yn - normalised y
 * @property {number} shift_x - normalised shift x
 * @property {number} shift_y - normalised shift y
 * @property {string} char - char
 * @property {CharUV} uv - original uv
 */

// Табличка
export default class style {

    static _aabb = new AABB();
    static _aabbc = new AABB();
    static _center = new Vector(0, 0, 0);
    static _padding = new Vector(0, 0, 0);

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['text'],
            func: this.func
        };
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {

        if(!block.extra_data || !block.extra_data.aabb) {
            return;
        }

        const aabb                  = style._aabb;
        const aabbc                 = style._aabbc;
        const center                = style._center.set(x, y, z);
        aabb.copyFrom(block.extra_data.aabb).pad(.1 / 16);

        const LETTER_W              = (aabb.width / 8) * .7;
        const LETTER_H              = (aabb.height / 4) * .6;
        const LETTER_SPACING_MUL    = 1;
        const PADDING               = style._padding.set(LETTER_W / 4, -LETTER_H / 4, 0);

        // Letter position
        let cx                      = 0;
        let cy                      = 0;

        function wrap() {
            cx = 0;
            cy++;
        }

        // Each over all text chars
        /**
         * @type {Char[]}
         */
        const chars = block.extra_data.chars;

        for(let char of chars) {
            if(char.char == "\r") {
                wrap();
                continue;
            }
            // Letter texture
            let c = [
                char.xn + char.width / 2,
                char.yn + char.height / 2,
                char.width,
                char.height
            ];
            // Letter position
            aabbc.copyFrom(aabb);
            aabbc.x_min += (cx * LETTER_W) * LETTER_SPACING_MUL;
            aabbc.x_max = aabbc.x_min + LETTER_W;
            aabbc.y_min = aabbc.y_max - (cy+1) * LETTER_H;
            aabbc.y_max = aabbc.y_min + LETTER_H;
            aabbc.translate(
                PADDING.x - aabbc.width * char.shift_x,
                PADDING.y - aabbc.height * char.shift_y,
                PADDING.z
            );
            // Push letter vertices
            pushAABB(
                vertices,
                aabbc,
                pivot,
                matrix,
                {
                    south:  new AABBSideParams(c, QUAD_FLAGS.QUAD_FLAG_SDF, 1, null, null, false)
                },
                center
            );
            cx++;
        }

        // Draw signature and date on backside
        const sign = block.extra_data.sign;
        if(sign) {
            cx = 0;
            // cy = 10;
            const SCALE_SIGN = 2;
            const plus_x = aabb.width * .5 - (sign.length * (LETTER_W * (LETTER_SPACING_MUL / SCALE_SIGN))) / 2;
            for(let char of sign) {
                if(char.char == "\r") {
                    wrap();
                    continue;
                }
                // Letter texture
                let c = [
                    char.xn + char.width / 2,
                    char.yn + char.height / 2,
                    char.width,
                    char.height
                ];
                // Letter position
                aabbc.copyFrom(aabb);
                aabbc.x_min += (cx * LETTER_W) * (LETTER_SPACING_MUL / SCALE_SIGN);
                aabbc.x_max = aabbc.x_min + LETTER_W / SCALE_SIGN;
                aabbc.y_min = aabb.y_min + LETTER_H / SCALE_SIGN, // aabbc.y_max - (cy+1) * LETTER_H / SCALE_SIGN;
                aabbc.y_max = aabbc.y_min + LETTER_H / SCALE_SIGN; // + LETTER_H / SCALE_SIGN;
                aabbc.translate(PADDING.x + plus_x, 0, PADDING.z);
                // Push letter vertices
                pushAABB(
                    vertices,
                    aabbc,
                    pivot,
                    matrix,
                    {
                        south:  new AABBSideParams(c, QUAD_FLAGS.QUAD_FLAG_SDF, 1, null, null, false)
                    },
                    center
                );
                cx++;
            }
        }

        return null;

    }

}