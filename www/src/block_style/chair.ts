import { DIRECTION, IndexedColor, Vector, QUAD_FLAGS} from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { default as default_style } from './default.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import type { BlockManager } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';

const {mat4} = glMatrix;
const pivot = {x: 0.5, y: 0.5, z: 0.5};

// стул
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['chair'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(tblock : TBlock, for_physic : boolean, world : any, neighbours : any, expanded?: boolean) : AABB[] {
        let aabb = new AABB().set(2/16, 0, 2/16, 14/16, 26/16, 14/16);
        if(for_physic) {
            aabb.y_max = 11/16;
        }
        if (tblock?.extra_data?.is_head) {
            aabb.translate(0, -1, 0);
        }
        return [aabb]
    }
    
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        if(!block || typeof block == 'undefined') {
            return;
        }
        const bm = style.block_manager
        const extra_data = block.extra_data ?? block.material.extra_data;
        if (extra_data?.is_head) {
            return;
        }
        const frame = (extra_data?.frame ? extra_data.frame : block.material.extra_data.frame).toUpperCase();
        const log = bm.calcTexture(bm[frame].texture, DIRECTION.UP);
        const parts = [];
        parts.push(...[
            // сиденье
            {
                "size": {"x": 12, "y": 3, "z": 12},
                "translate": {"x": 0, "y": 1.5, "z": 1},
                "faces": {
                    "up": {"uv": [8, 8], "texture": log},
                    "down": {"uv": [8, 8], "texture": log},
                    "north": {"uv": [8, 8], "texture": log},
                    "west":  {"uv": [8, 8], "texture": log},
                    "east":  {"uv": [8, 8], "texture": log}
                }
            },{ // ножка S-W
                "size": {"x": 2, "y": 8, "z": 2},
                "translate": {"x": -5, "y": -4, "z": -6},
                "faces": {
                    "down": {"uv": [8, 8], "texture": log},
                    "north": {"uv": [8, 8], "texture": log},
                    "south": {"uv": [8, 8], "texture": log},
                    "west":  {"uv": [8, 8], "texture": log},
                    "east":  {"uv": [8, 8], "texture": log}
                }
            },{ // ножка S-E
                "size": {"x": 2, "y": 8, "z": 2},
                "translate": {"x": 5, "y": -4, "z": -6},
                "faces": {
                    "down": {"uv": [8, 8], "texture": log},
                    "north": {"uv": [8, 8], "texture": log},
                    "south": {"uv": [8, 8], "texture": log},
                    "west":  {"uv": [8, 8], "texture": log},
                    "east":  {"uv": [8, 8], "texture": log}
                }
            },{ // разделитель спинки и сиденья
                "size": {"x": 12, "y": 3, "z": 2},
                "translate": {"x": 0, "y": 1.5, "z": -6},
                "faces": {
                    "down": {"uv": [8, 8], "texture": log},
                    "south": {"uv": [8, 8], "texture": log},
                    "west":  {"uv": [8, 8], "texture": log},
                    "east":  {"uv": [8, 8], "texture": log}
                }
            },{ // спинка
                "size": {"x": 12, "y": 15, "z": 2},
                "translate": {"x":0, "y": 10.5, "z": -6},
                "faces": {
                    "up": {"uv": [8, 8], "texture": log},
                    "north": {"uv": [8, 8], "texture": log},
                    "south": {"uv": [8, 8], "texture": log},
                    "west":  {"uv": [8, 8], "texture": log},
                    "east":  {"uv": [8, 8], "texture": log}
                }
            },{ // ножка W-N
                "size": {"x": 2, "y": 8, "z": 2},
                "translate": {"x": -5, "y": -4, "z": 6},
                "faces": {
                    "down": {"uv": [8, 8], "texture": log},
                    "north": {"uv": [8, 8], "texture": log},
                    "south": {"uv": [8, 8], "texture": log},
                    "west":  {"uv": [8, 8], "texture": log},
                    "east":  {"uv": [8, 8], "texture": log}
                }
            },{ // ножка E-N
                "size": {"x": 2, "y": 8, "z": 2},
                "translate": {"x": 5, "y": -4, "z": 6},
                "faces": {
                    "down": {"uv": [8, 8], "texture": log},
                    "north": {"uv": [8, 8], "texture": log},
                    "south": {"uv": [8, 8], "texture": log},
                    "west":  {"uv": [8, 8], "texture": log},
                    "east":  {"uv": [8, 8], "texture": log}
                }
            },{ // перекладина W
                "size": {"x": 0, "y": 2, "z": 10},
                "translate": {"x": -5.5, "y": -3, "z": 0},
                "faces": {
                    "west":  {"uv": [8, 8], "texture": log},
                    "east":  {"uv": [8, 8], "texture": log}
                }
            },{ // перекладина E
                "size": {"x": 0, "y": 2, "z": 10},
                "translate": {"x": 5.5, "y": -3, "z": 0},
                "faces": {
                    "west":  {"uv": [8, 8], "texture": log},
                    "east":  {"uv": [8, 8], "texture": log}
                }
            },{ // перекладина N
                "size": {"x": 8, "y": 2, "z": 0},
                "translate": {"x": 0, "y": -3, "z": 6.5},
                "faces": {
                    "north":  {"uv": [8, 8], "texture": log},
                    "south":  {"uv": [8, 8], "texture": log}
                }
            },{ // перекладина S
                "size": {"x": 8, "y": 2, "z": 0},
                "translate": {"x": 0, "y": -3, "z": -6.5},
                "faces": {
                    "north":  {"uv": [8, 8], "texture": log},
                    "south":  {"uv": [8, 8], "texture": log}
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
            const flag = QUAD_FLAGS.FLAG_MASK_COLOR_ADD;
            const wools = [];
            wools.push(...[
                // сиденье обивка
                {
                    "size": {"x": 11.6, "y": 0.5, "z": 11.6},
                    "translate": {"x": 0, "y": 3, "z": 1},
                    "faces": {
                        "up": {"uv": [8, 8], "flag": flag, "texture": upholstery},
                        "north": {"uv": [8, 8], "flag": flag, "texture": upholstery},
                        "south": {"uv": [8, 8], "flag": flag, "texture": upholstery},
                        "west":  {"uv": [8, 8], "flag": flag, "texture": upholstery},
                        "east":  {"uv": [8, 8], "flag": flag, "texture": upholstery}
                    }
                },{ // спинка обивка
                    "size": {"x": 11.6, "y": 12, "z": 0.5}, // 14.6
                    "translate": {"x":0, "y": 11.5, "z": -4.75},
                    "faces": {
                        "up": {"uv": [8, 8], "flag": flag, "texture": upholstery},
                        "down": {"uv": [8, 8], "flag": flag, "texture": upholstery},
                        "north": {"uv": [8, 8], "flag": flag, "texture": upholstery},
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