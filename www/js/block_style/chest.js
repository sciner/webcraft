import {DIRECTION, IndexedColor, Vector} from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { AABB } from '../core/AABB.js';
import { default as default_style } from './default.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;

// стойка для доспехов
export default class style {
    
    static getRegInfo() {
        return {
            styles: ['chest'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(block, for_physic) {
        const aabb = new AABB();
        aabb.set(1/16, 0, 1/16, 15/16, 14/16, 15/16);
        if(!for_physic) {
            aabb.pad(1/500);
        }
        return [aabb];
    }
    
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined') {
            return;
        }

        const c = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const flag = 0;
        const cd = block.getCardinalDirection();
        const rot = cd * (Math.PI / 2)
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;

        // shit texture coords to begin of texture (left upper corner)
        c[0] -= c[2] / 2;
        c[1] -= c[3] / 2;
        c[0] += .5/32
        c[1] += .5/32
        c[2] = 1/32
        c[3] = 1/32

        matrix = mat4.create();
        mat4.rotateY(matrix, matrix, rot);

        // бокс
        const box = {
            "size": {"x": 14, "y": 10, "z": 14},
            "translate": {"x":0, "y": -3, "z": 0},
            "faces": {
                "up": {"uv": [70/2, 52/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                "down": {"uv": [42/2, 52/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                "north": {"uv": [98/2, 76/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]},
                "east":  {"uv": [14/2, 76/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]}, // слева
                "south": {"uv": [42/2, 76/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]},
                "west":  {"uv": [70/2, 76/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]} // справа
            }
        };
        default_style.pushPART(vertices, {
            ...box,
            lm:         lm,
            pos:        pos,
            matrix:     matrix
        });

        // mat4.rotateX(matrix, matrix, Math.PI / 4);

        // крышка
        const lid = [
            {
                "size": {"x": 14, "y": 4, "z": 14},
                "translate": {"x":0, "y": 4, "z": 0},
                "faces": {
                    "up": {"uv": [70/2, 14/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                    "down": {"uv": [42/2, 14/2], "flag": flag, "texture": c},
                    "north": {"uv": [98/2, 33/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]}, // спереди
                    "east":  {"uv": [14/2, 33/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]},
                    "south": {"uv": [42/2, 33/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]},
                    "west":  {"uv": [70/2, 33/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]} // справа
                }
            },
            // замок
            {
                "size": {"x": 2, "y": 4, "z": 1},
                "translate": {"x":0, "y": 1, "z": 7.5},
                "faces": {
                    "up": {"uv": [8/2, 1/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                    "down": {"uv": [4/2, 1/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                    "north": {"uv": [10/2, 6/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]}, // спереди
                    "east":  {"uv": [1/2, 6/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]}, // слева
                    "south": {"uv": [4/2, 6/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]},
                    "west":  {"uv": [7/2, 6/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]} // справа
                }
            }
        ];

        for(let part of lid) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         lm,
                pos:        pos,
                matrix:     matrix
            });
        }

        // Add animations
        if(block.material.name == 'ENDER_CHEST' && typeof worker != 'undefined') {
            worker.postMessage(['add_animated_block', {
                block_pos: block.posworld,
                pos: [block.posworld.add(new Vector(.5, .5, .5))],
                type: 'ender_chest'
            }]);
        }

    }
    
}