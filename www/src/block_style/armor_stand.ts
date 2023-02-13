import {DIRECTION, IndexedColor, Vector} from '../helpers.js';
import {impl as alea} from "../../vendors/alea.js";
import { AABB } from '../core/AABB.js';
import { default as default_style } from './default.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { CHUNK_SIZE_X, CHUNK_SIZE_Z } from '../chunk_const.js';
import type { BlockManager } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';

const {mat4} = glMatrix;

const RANDOMS_COUNT = CHUNK_SIZE_X * CHUNK_SIZE_Z;
const randoms = new Array(RANDOMS_COUNT);
const a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

// стойка для доспехов
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['armor_stand'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    static computeAABB(tblock : TBlock, for_physic : boolean, world : any, neighbours : any, expanded?: boolean) : AABB[] {
        if (for_physic) {
            return [];
        }
        const aabb = new AABB();
        aabb.set(0.16, 0, 0.16, 0.84, 1, 0.84);
        return [aabb];
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        if(!block || typeof block == 'undefined') {
            return;
        }
        const bm = style.block_manager
        const rot = Math.round((((block.rotate.x - 2) / 4) * (Math.PI * 2)) / 0.5233) * 0.5233;
        const head_rot_index = Math.abs(Math.round(x * CHUNK_SIZE_Z + z)) % randoms.length;
        const head_rot = randoms[head_rot_index] * .2 - .1;
        const planks = bm.calcTexture(bm.OAK_LOG.texture, DIRECTION.UP);
        const stone = bm.calcTexture(bm.STONE.texture, DIRECTION.UP);
        const flag = 0;
        const parts = [];
        const stand = [];
        stand.push(...[
            // stand
            {
                "size": {"x": 12, "y": 1, "z": 12},
                "translate": {"x":0, "y": -7, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": stone},
                    "down": {"uv": [8, 8], "flag": flag, "texture": stone},
                    "north": {"uv": [8, 8], "flag": flag, "texture": stone},
                    "south": {"uv": [8, 8], "flag": flag, "texture": stone},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": stone},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": stone}
                }
            }
        ]);
        parts.push(...[
            // left leg
            {
                "size": {"x": 2, "y": 11, "z": 2},
                "translate": {"x":-2, "y": -2, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "down": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "north": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "south": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": planks},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": planks}
                }
            },
            // right leg
            {
                "size": {"x": 2, "y": 11, "z": 2},
                "translate": {"x":2, "y": -2, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "down": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "north": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "south": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": planks},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": planks}
                }
            },
            // body
            {
                "size": {"x": 8, "y": 2, "z": 2},
                "translate": {"x":0, "y": 4.5, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "down": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "north": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "south": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": planks},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": planks}
                }
            },{
                "size": {"x": 2, "y": 7, "z": 2},
                "translate": {"x":-2, "y": 9, "z": 0},
                "faces": {
                    "north": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "south": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": planks},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": planks}
                }
            },{
                "size": {"x": 2, "y": 7, "z": 2},
                "translate": {"x":2, "y": 9, "z": 0},
                "faces": {
                    "north": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "south": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": planks},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": planks}
                }
            },
            {
                "size": {"x": 10, "y": 3, "z": 3},
                "translate": {"x":0, "y": 14, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "down": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "north": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "south": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": planks},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": planks}
                }
            },
            // head
            {
                "size": {"x": 2, "y": 7, "z": 2},
                "translate": {"x":0, "y": 19, "z": 0},
                "rot": [0, head_rot, 0],
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "down": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "north": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "south": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": planks},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": planks}
                }
            },
            // left hand
            {
                "size": {"x": 2, "y": 12, "z": 2},
                "translate": {"x":-6, "y": 9.5, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "down": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "north": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "south": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": planks},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": planks}
                }
            },
            // right hand
            {
                "size": {"x": 2, "y": 12, "z": 2},
                "translate": {"x":6, "y": 9.5, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "down": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "north": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "south": {"uv": [8, 8], "flag": flag, "texture": planks},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": planks},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": planks}
                }
            }
        ]);
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;
        for(const el of stand) {
            default_style.pushPART(vertices, {
                ...el,
                lm:         lm,
                pos:        pos,
                matrix:     matrix
            });
        }
        matrix = mat4.create();
        mat4.rotateY(matrix, matrix, rot);
        for(const part of parts) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         lm,
                pos:        pos,
                matrix:     matrix
            });
        }

    }

}