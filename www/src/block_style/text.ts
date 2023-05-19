import { IndexedColor, QUAD_FLAGS, Vector} from '../helpers.js';
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import { BlockStyleRegInfo } from './default.js';
import type { TBlock } from '../typed_blocks3.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';

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

const colorMap = {
    '0': [0, 0, 0], // 'color:#000000',
    '1': [0, 0, 170], // 'color:#0000AA',
    '2': [0, 170, 0], // 'color:#00AA00',
    '3': [0, 170, 170], // 'color:#00AAAA',
    '4': [170, 0, 0], // 'color:#AA0000',
    '5': [170, 0, 170], // 'color:#AA00AA',
    '6': [255, 170, 0], // 'color:#FFAA00',
    '7': [255, 255, 255], // 'color:#AAAAAA',
    '8': [85, 85, 85], // 'color:#555555',
    '9': [85, 85, 255], // 'color:#5555FF',
    'a': [85, 255, 85], // 'color:#55FF55',
    'b': [85, 255, 255], // 'color:#55FFFF',
    'c': [255, 85, 85], // 'color:#FF5555',
    'd': [255, 85, 255], // 'color:#FF55FF',
    'e': [255, 255, 85], // 'color:#FFFF55',
    'f': [255, 255, 255], // 'color:#FFFFFF',
    // 'l': 'font-weight:bold',
    // 'm': 'text-decoration:line-through',
    // 'n': 'text-decoration:underline',
    // 'o': 'font-style:italic',
}

const code_char = '§'

// Табличка
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static _aabb = new AABB();
    static _aabbc = new AABB();
    static _center = new Vector(0, 0, 0);
    static _padding = new Vector(0, 0, 0);

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['text'],
            this.func
        );
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
                cursorY++
                cursorX = 0
                continue
            }

            cursorX += char.uv.xadvance;
            maxX = Math.max(maxX, cursorX);
        }

        maxY = cursorY * baseHeight;

        const refScale = Math.min( aabb.height / totalHeight, aabb.width / maxX);

        cursorX = 0;
        cursorY = 0;

        const default_color = color

        for(let i = 0; i < chars.length; i++) {
            const char = chars[i]

            if(char.char == "\r") {
                cursorY ++
                cursorX = 0;
                continue
            } else if(char.char == code_char && i < chars.length - 2) {
                const next_char = chars[i + 1]
                switch(next_char.char) {
                    case 'r': {
                        color = default_color
                        i++
                        break
                    }
                    default: {
                        const _c = colorMap[next_char.char]
                        if(_c) {
                            color = _c
                            i++
                        }
                        break
                    }
                }
                continue
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

            let flags = QUAD_FLAGS.QUAD_FLAG_SDF

            // Push letter vertices
            pushAABB(
                vertices,
                aabbc,
                pivot,
                matrix,
                {
                    south:  new AABBSideParams(c, flags, 1, null, null, false, color)
                },
                center
            );
        }
    }

    // Build function
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

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