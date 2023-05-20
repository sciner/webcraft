import { IndexedColor, QUAD_FLAGS, Vector} from '../helpers.js';
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import { BlockStyleRegInfo } from './default.js';
import type { TBlock } from '../typed_blocks3.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';

declare type CharUV = {
    width:      number
    height:     number
    xadvance:   number
    yoffset:    number
    x:          number
    y:          number
    char:       string
}

declare type Char = {
    Char:       object //
    width:      number // normalised width
    height:     number // normalised height
    xn:         number // normalised x
    yn:         number // normalised y
    shift_x:    number // normalised shift x
    shift_y:    number // normalised shift y
    char:       string // char
    uv:         CharUV // original uv
}

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

    static _aabb = new AABB()
    static _aabbc = new AABB()
    static _center = new Vector(0, 0, 0)
    static _padding = new Vector(0, 0, 0)
    static _letter_tex = [0, 0, 0, 0]
    static _aabb_char = {
        south:  new AABBSideParams()
    }

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['text'],
            this.func
        );
    }

    static fillRun({
        aabb,
        chars,
        vertices,
        baseHeight = 38,
        line_count = 5,
        pivot,
        matrix,
        center,
        alignCenter = true,
        color = [255, 255, 255]
    }) {

        // baseHeight = aabb.height * 100

        const aabbc = style._aabbc
        const totalHeight = baseHeight * line_count
        const lines = []
        let line_x = 0

        const addLine = () => {
            const width = line_x
            const refScale = Math.min( aabb.height / totalHeight, aabb.width / width)
            const line = {width, refScale}
            lines.push(line)
            line_x = 0
            return line
        }

        // Pre-pass for compute real lines width and count
        for(let i = 0; i < chars.length; i++) {
            const char = chars[i]
            if(char.char === '\r') {
                addLine()
                continue
            } else if(char.char == code_char && i < chars.length - 2) {
                i++
                continue
            }
            line_x += char.uv.xadvance
        }
        addLine()

        //
        const total_height = (lines.length + 1) * baseHeight
        const default_color = color
        let line = lines.shift()
        let line_index = 0

        for(let i = 0; i < chars.length; i++) {
            const char = chars[i]
            const { width, refScale } = line

            if(char.char == '\r') {
                line = lines.shift()
                line_index++
                line_x = 0
                continue
            }

            if(char.char == code_char && i < chars.length - 2) {
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

            const uv = char.uv

            // Letter texture
            style._letter_tex[0] = char.xn + char.width / 2
            style._letter_tex[1] = char.yn + char.height / 2
            style._letter_tex[2] = char.width
            style._letter_tex[3] = char.height

            // Letter position
            aabbc.copyFrom(aabb);
            aabbc.x_min += line_x * refScale * uv.xadvance
            aabbc.x_max = aabbc.x_min + refScale * uv.width
            aabbc.y_min += (-line_index * baseHeight - uv.yoffset) * refScale
            aabbc.y_max = aabbc.y_min + refScale * uv.height

            line_x++

            aabbc.translate(0, -aabbc.height + aabb.height, 0)

            if (alignCenter) {
                aabbc.translate(
                    -(width * refScale - aabb.width) * 0.5,
                    (total_height * refScale - aabb.height) * 0.5,
                    0
                )
            }

            const flags = QUAD_FLAGS.QUAD_FLAG_SDF

            style._aabb_char.south.set(style._letter_tex, flags, 1, null, null, false, color)

            // aabbc.copyFrom(aabb)

            // Push letter vertices
            pushAABB(vertices, aabbc, pivot, matrix, style._aabb_char, center)

            // break

        }

    }

    // Build function
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        if(!block.extra_data || !block.extra_data.aabb) {
            return;
        }

        const BASE_HEIGHT           = 30; // from atlas
        const LINES                 = 5

        const aabb                  = style._aabb
        const aabbc                 = style._aabbc
        const center                = style._center.set(x, y, z)

        aabb.copyFrom(block.extra_data.aabb).pad(.1 / 16)
        aabb.x_min += 1 / 16
        aabb.y_min += 1 / 16
        aabb.x_max -= 1 / 16
        aabb.y_max -= 1 / 32

        const is_bb = !!block.extra_data.bb

        if(is_bb) {
            aabb.y_max -= 1 / 32
            aabb.translate(0, -1/32, .5/32)
        }

        // Each over all text chars
        const chars : Char[] = block.extra_data.chars

        const args = {
            aabb,
            chars,
            vertices,
            line_count: LINES,
            baseHeight: BASE_HEIGHT,
            center,
            matrix,
            pivot
        }
        style.fillRun(args);

        // Draw player signature
        const sign = block.extra_data.sign
        if(sign) {
            if(is_bb) {
                aabb.translate(0, 0, -.5/32)
            }
            aabb.y_min -= 1/24
            aabb.y_max = aabb.y_min + aabb.height * 0.1
            style.fillRun({
                ...args,
                aabb,
                // render only 1 line
                // at center
                chars: sign,
                line_count: 1,
                alignCenter: true,
            })
        }

        return null

    }

}