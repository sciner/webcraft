import {DIRECTION, QUAD_FLAGS, MULTIPLY, Vector} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {AABB} from '../core/AABB.js';
import { default as default_style } from './default.js';
import {CubeSym} from "../core/CubeSym.js";
import glMatrix from '../../vendors/gl-matrix-3.3.min.js';

const WIDTH =  16 / 32;
const HEIGHT = 20 / 32;

const {mat4} = glMatrix;

const lm = MULTIPLY.COLOR.WHITE.clone();
lm.b = 1;

// getAnimations...
let getAnimations = (material, side) => {
    if(!material.texture_animations) {
        return 1;
    }
    if(side in material.texture_animations) {
        return material.texture_animations[side];
    } else if('side' in material.texture_animations) {
        return material.texture_animations['side'];
    }
    return 1;
};

// Фонарь
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['cocoa'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {
        let y = 1 - .85;
        let aabb = new AABB();
        aabb.set(
            0 + .5 - WIDTH / 2,
            y,
            0 + .5 - WIDTH / 2,
            0 + .5 + WIDTH / 2,
            y + HEIGHT,
            0 + .5 + WIDTH / 2,
        );
        const a = ((block.rotate.x - 1) / 4) * (2 * Math.PI);
        aabb.translate(.22 * Math.cos(a), 0, .22 * Math.sin(a));
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        const c_up_top          = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP, null, null, block);
        const animations_side   = getAnimations(block.material, 'side');
        const stage             = block.extra_data.stage;
        const flag              = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP;

        const rot = [0, ((block.rotate.x - 1) / 4) * (2 * Math.PI), 0];

        lm.b = animations_side;

        const pos = new Vector(x, y, z);

        // 1. Chains
        const planes = [];
        planes.push(...[
            {"size": {"x": 0, "y": 4, "z": 4}, "uv": [14, 2], "rot": [0, 0, 0], "translate": {"x": 0, "y": 6, "z": -6}}
        ]);

        let plane_matrix = mat4.create();
        mat4.rotateY(plane_matrix, plane_matrix, rot[1] + Math.PI/2);

        for(let plane of planes) {
            default_style.pushPlane(vertices, {
                ...plane,
                lm:         lm,
                pos:        pos,
                matrix:     plane_matrix,
                flag:       flag,
                texture:    [...c_up_top]
            });
        }

        // 2. Parts
        const parts = [];
        switch(stage) {
            case 0: {
                parts.push({
                    "size": {"x": 4, "y": 5, "z": 4},
                    "translate": {"x": 5, "y": 1.5, "z": 0},
                    "faces": {
                        "down":  {"uv": [2, 2], "flag": flag, "texture": c_up_top},
                        "up":    {"uv": [2, 2], "flag": flag, "texture": c_up_top},
                        "north": {"uv": [13, 6.5], "flag": flag, "texture": c_up_top},
                        "south": {"uv": [13, 6.5], "flag": flag, "texture": c_up_top},
                        "west":  {"uv": [13, 6.5], "flag": flag, "texture": c_up_top},
                        "east":  {"uv": [13, 6.5], "flag": flag, "texture": c_up_top}
                    }
                });
                break;
            }
            case 1: {
                parts.push({
                    "size": {"x": 6, "y": 7, "z": 6},
                    "translate": {"x": 4, "y": .5, "z": 0},
                    "faces": {
                        "down":  {"uv": [3, 3], "flag": flag, "texture": c_up_top},
                        "up":    {"uv": [3, 3], "flag": flag, "texture": c_up_top},
                        "north": {"uv": [12, 7.5], "flag": flag, "texture": c_up_top},
                        "south": {"uv": [12, 7.5], "flag": flag, "texture": c_up_top},
                        "west":  {"uv": [12, 7.5], "flag": flag, "texture": c_up_top},
                        "east":  {"uv": [12, 7.5], "flag": flag, "texture": c_up_top}
                    }
                });
                break;
            }
            case 2: {
                parts.push({
                    "size": {"x": 7, "y": 9, "z": 7},
                    "translate": {"x": 3.5, "y": -.5, "z": 0},
                    "faces": {
                        "down":  {"uv": [3.5, 3.5], "flag": flag, "texture": c_up_top},
                        "up":    {"uv": [3.5, 3.5], "flag": flag, "texture": c_up_top},
                        "north": {"uv": [11, 8.5], "flag": flag, "texture": c_up_top},
                        "south": {"uv": [11, 8.5], "flag": flag, "texture": c_up_top},
                        "west":  {"uv": [11, 8.5], "flag": flag, "texture": c_up_top},
                        "east":  {"uv": [11, 8.5], "flag": flag, "texture": c_up_top}
                    }
                });
                break;
            }
        }

        for(let part of parts) {
            default_style.pushAABB(vertices, {
                ...part,
                lm:         lm,
                pos:        pos,
                rot:        rot,
                matrix:     matrix
            });
        }

        return null;

    }

}