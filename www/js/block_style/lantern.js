import {DIRECTION, QUAD_FLAGS, IndexedColor, Vector} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {AABB} from '../core/AABB.js';
import { default as default_style } from './default.js';

const WIDTH =  12 / 32;
const HEIGHT = 14 / 32;

const WIDTH_INNER = 8/32;
const HEIGHT_INNER = 4/32;

const CONNECT_HEIGHT_ON_CEIL = 6 / 16;

const lm = IndexedColor.WHITE.clone();

// Фонарь
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['lantern'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {
        let y = 0;
        if(block.rotate.y == -1) {
            y += 1 - HEIGHT - HEIGHT_INNER - CONNECT_HEIGHT_ON_CEIL;
        }
        let aabb = new AABB();
        aabb.set(
            0 + .5 - WIDTH / 2,
            y,
            0 + .5 - WIDTH / 2,
            0 + .5 + WIDTH / 2,
            y + HEIGHT,
            0 + .5 + WIDTH / 2,
        );
        let aabb2 = new AABB();
        aabb2.set(
            0 + .5 - WIDTH_INNER / 2,
            y + HEIGHT,
            0 + .5 - WIDTH_INNER / 2,
            0 + .5 + WIDTH_INNER / 2,
            y + HEIGHT + HEIGHT_INNER,
            0 + .5 + WIDTH_INNER / 2,
        );
        return [aabb, aabb2];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        const c_up_top          = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const animations_side   = BLOCK.getAnimations(block.material, 'side');
        const on_ceil           = block.rotate.y == -1;
        const flag              = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP | QUAD_FLAGS.FLAG_ANIMATED;

        lm.b = animations_side;

        const pos = new Vector(x, y, z);

        // 1. Chains
        const planes = [];
        if(on_ceil) {
            planes.push(...[
                {"size": {"x": 0, "y": 2, "z": 3}, "uv": [12.5, 11], "rot": [0, -Math.PI / 4, 0], "translate": {"x": 0, "y": 3, "z": 0}}, // up
                {"size": {"x": 0, "y": 4, "z": 3}, "uv": [12.5, 3], "rot": [0, Math.PI / 4, 0], "translate": {"x": 0, "y": 5, "z": 0}}, // full
                {"size": {"x": 0, "y": 2, "z": 3}, "uv": [12.5, 7], "rot": [0, -Math.PI / 4, 0], "translate": {"x": 0, "y": 7, "z": 0}} // down
            ]);
        } else {
            planes.push(...[
                {"size": {"x": 0, "y": 2, "z": 3}, "uv": [12.5, 11], "rot": [0, Math.PI / 4, 0], "translate": {"x": 0, "y": 2, "z": 0}}, // up
                {"size": {"x": 0, "y": 2, "z": 3}, "uv": [12.5, 11], "rot": [0, -Math.PI / 4, 0], "translate": {"x": 0, "y": 2, "z": 0}}, // up
            ]);
        }
        for(let plane of planes) {
            default_style.pushPlane(vertices, {
                ...plane,
                lm:         lm,
                pos:        pos,
                matrix:     matrix,
                flag:       flag,
                texture:    [...c_up_top]
            });
        }

        // 2. Parts
        const parts = [];
        const translate_y = on_ceil ? 1 : 0;
        parts.push(...[
            {
                "size": {"x": 4, "y": 2, "z": 4},
                "translate": {"x": 0, "y": translate_y, "z": 0},
                "faces": {
                    "down":  {"uv": [3, 12], "flag": flag, "texture": c_up_top},
                    "up":    {"uv": [3, 12], "flag": flag, "texture": c_up_top},
                    "north": {"uv": [3, 1], "flag": flag, "texture": c_up_top},
                    "south": {"uv": [3, 1], "flag": flag, "texture": c_up_top},
                    "west":  {"uv": [3, 1], "flag": flag, "texture": c_up_top},
                    "east":  {"uv": [3, 1], "flag": flag, "texture": c_up_top}
                }
            },
            {
                "size": {"x": 6, "y": 7, "z": 6},
                "translate": {"x": 0, "y": -4.5 + translate_y, "z": 0},
                "faces": {
                    "down":  {"uv": [3, 12], "flag": flag, "texture": c_up_top},
                    "up":    {"uv": [3, 12], "flag": flag, "texture": c_up_top},
                    "north": {"uv": [3, 5.5], "flag": flag, "texture": c_up_top},
                    "south": {"uv": [3, 5.5], "flag": flag, "texture": c_up_top},
                    "west":  {"uv": [3, 5.5], "flag": flag, "texture": c_up_top},
                    "east":  {"uv": [3, 5.5], "flag": flag, "texture": c_up_top}
                }
            }
        ]);
        for(let part of parts) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         lm,
                pos:        pos,
                matrix:     matrix
            });
        }

        return null;

    }

}