import { QUAD_FLAGS, Vector} from '../helpers.js';
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
    [key: string]: any;

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

    static fillRun ({
        aabb,
        chars,
        vertices,
        baseHeight = 38,
        lines = 4,
        pivot,
        matrix,
        center,
        alignCenter = false,
        color = [255, 255, 255]
    }) {
        const aabbc = style._aabbc;
        const totalHeight = baseHeight * lines;

        let cursorX = 0;
        let cursorY = 1;
        let maxX = 0;
        let maxY = 0;

        // pre-pass
        // compute real width
        for(let char of chars) {
            if (char.char === '\r') {
                cursorY ++;
                cursorX = 0;
                continue;
            }

            cursorX += char.uv.xadvance;
            maxX = Math.max(maxX, cursorX);
        }

        maxY = cursorY * baseHeight;

        const refScale = Math.min( aabb.height / totalHeight, aabb.width / maxX);

        cursorX = 0;
        cursorY = 0;

        for(let char of chars) {
            if(char.char == "\r") {
                cursorY ++
                cursorX = 0;
                continue;
            }

            const uv = char.uv;
            // Letter texture
            const c = [
                char.xn + char.width / 2,
                char.yn + char.height / 2,
                char.width,
                char.height
            ];

            // Letter position
            aabbc.copyFrom(aabb);

            aabbc.x_min += cursorX * refScale * uv.xadvance;
            aabbc.x_max = aabbc.x_min + refScale * uv.width;

            aabbc.y_min += refScale * (-cursorY * baseHeight - uv.yoffset);
            aabbc.y_max = aabbc.y_min + refScale * uv.height;

            cursorX++;

            aabbc.translate(
                0,
                - aabbc.height + aabb.height,
                0
            );

            if (alignCenter) {
                aabbc.translate(
                    -(maxX * refScale - aabb.width) * 0.5,
                    (maxY * refScale - aabb.height) * 0.5,
                    0
                );

            }

            // Push letter vertices
            pushAABB(
                vertices,
                aabbc,
                pivot,
                matrix,
                {
                    south:  new AABBSideParams(c, QUAD_FLAGS.QUAD_FLAG_SDF, 1, null, null, false, color)
                },
                center
            );
        }
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block.extra_data || !block.extra_data.aabb) {
            return;
        }

        const BASE_HEIGHT           = 38; // from atlas
        const LINES                 = 4;

        const aabb                  = style._aabb;
        const aabbc                 = style._aabbc;
        const center                = style._center.set(x, y, z);

        aabb.copyFrom(block.extra_data.aabb).pad(.1 / 16);
        aabb.x_min += 1 / 16;
        aabb.y_min += 1 / 16;
        aabb.x_max -= 1 / 16;
        aabb.y_max -= 1 / 32;


        // Each over all text chars
        /**
         * @type {Char[]}
         */
        const chars = block.extra_data.chars;

        const args = {
            aabb,
            chars,
            vertices,
            lines: LINES + 1,
            baseHeight: BASE_HEIGHT,
            center,
            matrix,
            pivot
        }
        style.fillRun(args);

        const sign = block.extra_data.sign;
        if(sign) {
            aabb.y_min -= 1/24;
            aabb.y_max = aabb.y_min + aabb.height * 0.1;

            style.fillRun({
                ...args,
                aabb,
                // render only 1 line
                // at center
                chars: sign,
                lines: 1,
                alignCenter: true,
            })
        }

        return null;

    }

}