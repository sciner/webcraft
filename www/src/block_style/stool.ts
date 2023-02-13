import { DIRECTION, IndexedColor, Vector, QUAD_FLAGS } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { default as default_style } from './default.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import type { BlockManager } from '../blocks.js';

const {mat4} = glMatrix;

// табуретка
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['stool'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    static computeAABB(block, for_physic) {
        const shapes = [];
        const height = for_physic ? 11/16 : 12/16;
        shapes.push(new AABB().set(0.125, 0, 0.125, 0.875, height, 0.875));
        return shapes;
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        if(!block || typeof block == 'undefined') {
            return;
        }
        const bm = style.block_manager
        const extra_data = block.extra_data ?? block.material.extra_data;
        const frame = (extra_data?.frame ? extra_data.frame : block.material.extra_data.frame).toUpperCase();
        const log = bm.calcTexture(bm[frame].texture, DIRECTION.UP);
        const parts = [];
        parts.push(...[
            // сиденье
            {
                "size": {"x": 12, "y": 2, "z": 12},
                "translate": {"x": 0, "y": 2, "z": 0},
                "rot": [0, 0, 0],
                "faces": {
                    "up": {"uv": [8, 8], "texture": log},
                    "down": {"uv": [8, 8], "texture": log},
                    "north": {"uv": [8, 8], "texture": log},
                    "south": {"uv": [8, 8], "texture": log},
                    "west":  {"uv": [8, 8], "texture": log},
                    "east":  {"uv": [8, 8], "texture": log}
                }
            },{// ножка W
                "size": {"x": 2, "y": 10.5, "z": 2},
                "translate": {"x": 0, "y": -5, "z": 3},
                "rot": [-Math.PI / 8, 0, 0],
                "faces": {
                    "down": {"uv": [8, 8], "texture": log},
                    "north": {"uv": [8, 8], "texture": log},
                    "south": {"uv": [8, 8], "texture": log},
                    "west":  {"uv": [8, 8], "texture": log},
                    "east":  {"uv": [8, 8], "texture": log}
                }
            },{// ножка E
                "size": {"x": 2, "y": 10.5, "z": 2},
                "translate": {"x": 0, "y": -5, "z": -3},
                "rot": [Math.PI / 8, 0, 0],
                "faces": {
                    "down": {"uv": [8, 8], "texture": log},
                    "north": {"uv": [8, 8], "texture": log},
                    "south": {"uv": [8, 8], "texture": log},
                    "west":  {"uv": [8, 8], "texture": log},
                    "east":  {"uv": [8, 8], "texture": log}
                }
            },{// ножка S
                "size": {"x": 2, "y": 10.5, "z": 2},
                "translate": {"x": -3, "y": -5, "z": 0},
                "rot": [0, 0, -Math.PI / 8],
                "faces": {
                    "down": {"uv": [8, 8], "texture": log},
                    "north": {"uv": [8, 8], "texture": log},
                    "south": {"uv": [8, 8], "texture": log},
                    "west":  {"uv": [8, 8], "texture": log},
                    "east":  {"uv": [8, 8], "texture": log}
                }
            },{// ножка N
                "size": {"x": 2, "y": 10.5, "z": 2},
                "translate": {"x": 3, "y": -5, "z": 0},
                "rot": [0, 0, Math.PI / 8],
                "faces": {
                    "down": {"uv": [8, 8], "texture": log},
                    "north": {"uv": [8, 8], "texture": log},
                    "south": {"uv": [8, 8], "texture": log},
                    "west":  {"uv": [8, 8], "texture": log},
                    "east":  {"uv": [8, 8], "texture": log}
                }
            }
        ]);
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;
        matrix = mat4.create();
        if(block.rotate) {
            if(block.rotate.y == 0) {
                mat4.rotateY(matrix, matrix, (block.rotate.x / 4) * -(2 * Math.PI));
            } else {
                mat4.rotateY(matrix, matrix, Math.PI / 180 * (block.rotate?.x ?? 0));
            }
        }

        for(const part of parts) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         lm,
                pos:        pos,
                matrix:     matrix
            });
        }

        if (extra_data?.upholstery) {
            const mat = bm[extra_data.upholstery.toUpperCase()];
            const upholstery = bm.calcTexture(mat.texture, DIRECTION.UP);
            const color = new IndexedColor(mat.mask_color.r, mat.mask_color.g, 0, 0);
            const flag = QUAD_FLAGS.MASK_BIOME;
            const wools = [];
            wools.push(...[
                // сиденье обивка
                {
                    "size": {"x": 11.6, "y": 0.5, "z": 11.6},
                    "translate": {"x": 0, "y": 3, "z": 0},
                    "rot": [0, 0, 0],
                    "faces": {
                        "up": {"uv": [8, 8], "flag": flag, "texture": upholstery},
                        "north": {"uv": [8, 8], "flag": flag, "texture": upholstery},
                        "south": {"uv": [8, 8], "flag": flag, "texture": upholstery},
                        "west":  {"uv": [8, 8], "flag": flag, "texture": upholstery},
                        "east":  {"uv": [8, 8], "flag": flag, "texture": upholstery}
                    }
                }
            ]);
            for(const wool of wools) {
                default_style.pushPART(vertices, {
                    ...wool,
                    lm:         color,
                    pos:        pos,
                    matrix:     matrix
                });
            }
        }
    }

}