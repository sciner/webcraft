import {DIRECTION, IndexedColor, Vector} from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { AABB } from '../core/AABB.js';
import { default as default_style } from './default.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;

// стойка для доспехов
export default class style {
    [key: string]: any;

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
        const type = block.extra_data?.type;
        if (type) {
            const dir = BLOCK.getCardinalDirection(block.rotate);
            const sign = type === 'left' ? 1 : -1;
            const len = for_physic ? 1/16 : 1;
            tmp_vec.set(len * sign, 0, 0);
            tmp_vec.rotateByCardinalDirectionSelf(dir);
            aabb.addSelfTranslatedByVec(tmp_vec);
        }
        if(!for_physic) {
            aabb.pad(1/500);
        }
        return [aabb]
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined') {
            return;
        }

        const type = block.extra_data?.type || 'side';
        const texName = type === 'left' ? 'right' : type; // use 'right' texture for both sides

        const tex = block.material.texture[texName];
        const c = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP, null, null, null, tex);

        const flag = 0;
        const cd = block.getCardinalDirection();
        const rot = cd * -(Math.PI / 2)
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

        const tx_cnt = block.material.tx_cnt ?? 32

        var box;
        var lid;
        switch(type) {
            case 'side': {
                box = {
                    "size": {"x": 14, "y": 10, "z": 14},
                    "translate": {"x": 0, "y": -3, "z": 0},
                    "faces": {
                        "up": {tx_cnt, "uv": [70/2, 52/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                        "down": {tx_cnt, "uv": [42/2, 52/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                        "north": {tx_cnt, "uv": [98/2, 76/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]},
                        "east":  {tx_cnt, "uv": [14/2, 76/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]}, // слева
                        "south": {tx_cnt, "uv": [42/2, 76/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]},
                        "west":  {tx_cnt, "uv": [70/2, 76/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]} // справа
                    }
                };
                lid = [
                    // крышка
                    {
                        "size": {"x": 14, "y": 4, "z": 14},
                        "translate": {"x": 0, "y": 4, "z": 0},
                        "faces": {
                            "up": {tx_cnt, "uv": [70/2, 14/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                            "down": {tx_cnt, "uv": [42/2, 14/2], "flag": flag, "texture": c},
                            "north": {tx_cnt, "uv": [98/2, 33/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]}, // спереди
                            "east":  {tx_cnt, "uv": [14/2, 33/2], "flag": flag, "texture": [c[0], c[1], c[2], c[3]]},
                            "south": {tx_cnt, "uv": [42/2, 33/2], "flag": flag, "texture": [c[0], c[1], c[2], c[3]]},
                            "west":  {tx_cnt, "uv": [70/2, 33/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]} // справа
                        }
                    },
                    // замок
                    {
                        "size": {"x": 2, "y": 4, "z": 1},
                        "translate": {"x": 0, "y": 1, "z": 7.5},
                        "faces": {
                            "up": {tx_cnt, "uv": [8/2, 1/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                            "down": {tx_cnt, "uv": [4/2, 1/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                            "north": {tx_cnt, "uv": [10/2, 6/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]}, // спереди
                            "east":  {tx_cnt, "uv": [1/2, 6/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]}, // слева
                            "south": {tx_cnt, "uv": [4/2, 6/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]},
                            "west":  {tx_cnt, "uv": [7/2, 6/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]} // справа
                        }
                    }
                ];
                break;
            }
            // We add invisible inner sides to halves because when one half is destroyed by the client,
            // the other is temporarily visible from all sides.
            case 'left': {
                box = {
                    "size": {"x": 15, "y": 10, "z": 14},
                    "translate": {"x": 0.5, "y": -3, "z": 0},
                    "faces": {
                        "up": {tx_cnt, "uv": [(58+88)/2/2, 52/2], "flag": flag, "texture": c},
                        "down": {tx_cnt, "uv": [(28+58)/2/2, 52/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                        "north": {tx_cnt, "uv": [(86+116)/2/2, 76/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]},
                        "east":  {tx_cnt, "uv": [(0+28)/2/2, 76/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]}, // слева
                        "south": {tx_cnt, "uv": [(28+58)/2/2, 76/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]},
                        "west":  {tx_cnt, "uv": [(0+28)/2/2, 76/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]} // справа
                    }
                };
                lid = [
                    // крышка
                    {
                        "size": {"x": 15, "y": 4, "z": 14},
                        "translate": {"x": 0.5, "y": 4, "z": 0},
                        "faces": {
                            "up": {tx_cnt, "uv": [(58+88)/2/2, 14/2], "flag": flag, "texture": c},
                            "down": {tx_cnt, "uv": [(28+58)/2/2, 14/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                            "north": {tx_cnt, "uv": [(86+116)/2/2, 33/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]}, // спереди
                            "east":  {tx_cnt, "uv": [(0+28)/2/2, 33/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]},
                            "south": {tx_cnt, "uv": [(28+58)/2/2, 33/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]},
                            "west":  {tx_cnt, "uv": [(0+28)/2/2, 33/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]} // справа
                        }
                    },
                    // замок
                    {
                        "size": {"x": 1, "y": 4, "z": 1},
                        "translate": {"x": 7.5, "y": 1, "z": 7.5},
                        "faces": {
                            "up": {tx_cnt, "uv": [5/2, 1/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                            "down": {tx_cnt, "uv": [3/2, 1/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                            "north": {tx_cnt, "uv": [7/2, 6/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]}, // спереди
                            "south": {tx_cnt, "uv": [1/2, 6/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]},
                            "west":  {tx_cnt, "uv": [7/2, 6/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]}, // слева
                        }
                    }
                ];
                break;
            }
            default: { // case 'right':
                box = {
                    "size": {"x": 15, "y": 10, "z": 14},
                    "translate": {"x": -0.5, "y": -3, "z": 0},
                    "faces": {
                        "up": {tx_cnt, "uv": [(58+88)/2/2, 52/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                        "down": {tx_cnt, "uv": [(28+58)/2/2, 52/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                        "north": {tx_cnt, "uv": [(86+116)/2/2, 76/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]},
                        "east":  {tx_cnt, "uv": [(0+28)/2/2, 76/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]}, // слева
                        "south": {tx_cnt, "uv": [(28+58)/2/2, 76/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]},
                        "west":  {tx_cnt, "uv": [(0+28)/2/2, 76/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]} // справа
                    }
                };
                lid = [
                    // крышка
                    {
                        "size": {"x": 15, "y": 4, "z": 14},
                        "translate": {"x": -0.5, "y": 4, "z": 0},
                        "faces": {
                            "up": {tx_cnt, "uv": [(58+88)/2/2, 14/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                            "down": {tx_cnt, "uv": [(28+58)/2/2, 14/2], "flag": flag, "texture": c},
                            "north": {tx_cnt, "uv": [(86+116)/2/2, 33/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]}, // спереди
                            "east":  {tx_cnt, "uv": [(0+28)/2/2, 33/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]},
                            "south": {tx_cnt, "uv": [(28+58)/2/2, 33/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]},
                            "west":  {tx_cnt, "uv": [(0+28)/2/2, 33/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]} // справа
                        }
                    },
                    // замок
                    {
                        "size": {"x": 1, "y": 4, "z": 1},
                        "translate": {"x":-7.5, "y": 1, "z": 7.5},
                        "faces": {
                            "up": {tx_cnt, "uv": [5/2, 1/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                            "down": {tx_cnt, "uv": [3/2, 1/2], "flag": flag, "texture": [c[0], c[1], -c[2], c[3]]},
                            "north": {tx_cnt, "uv": [7/2, 6/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]}, // спереди
                            "east":  {tx_cnt, "uv": [1/2, 6/2], "flag": flag, "texture": [c[0], c[1], -c[2], -c[3]]}, // справа
                            "south": {tx_cnt, "uv": [7/2, 6/2], "flag": flag, "texture": [c[0], c[1], c[2], -c[3]]}
                        }
                    }
                ];
                break;
            }
        }

        default_style.pushPART(vertices, {
            ...box,
            lm:         lm,
            pos:        pos,
            matrix:     matrix
        });

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

const tmp_vec = new Vector();