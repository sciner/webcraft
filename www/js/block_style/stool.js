import { DIRECTION, IndexedColor, Vector } from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { AABB } from '../core/AABB.js';
import { default as default_style } from './default.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;
const pivot = {x: 0.5, y: 0.5, z: 0.5};

// стул
export default class style {
    
    static getRegInfo() {
        return {
            styles: ['stool'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(block, for_physic) {
        const cd = block.getCardinalDirection();
        const aabbs = [];
        aabbs.push(new AABB().set(0, 0, 0, 1, 0.7, 1));
        return aabbs;
    }
    
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        if(!block || typeof block == 'undefined') {
            return;
        }
        const log = BLOCK.calcTexture(block.material.texture, DIRECTION.UP);
        const flag = 0;
        const parts = [];
        parts.push(...[
            // сиденье
            {
                "size": {"x": 12, "y": 2, "z": 12},
                "translate": {"x": 0, "y": 2, "z": 0},
                "rot": [0, Math.PI / 4, 0],
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": log},
                    "down": {"uv": [8, 8], "flag": flag, "texture": log},
                    "north": {"uv": [8, 8], "flag": flag, "texture": log},
                    "south": {"uv": [8, 8], "flag": flag, "texture": log},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": log}
                }
            },{// ножка W
                "size": {"x": 2, "y": 10.5, "z": 2},
                "translate": {"x": 0, "y": -5, "z": 3},
                "rot": [Math.PI / 8, 0, 0],
                "faces": {
                    "down": {"uv": [8, 8], "flag": flag, "texture": log},
                    "north": {"uv": [8, 8], "flag": flag, "texture": log},
                    "south": {"uv": [8, 8], "flag": flag, "texture": log},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": log}
                }
            },{// ножка E
                "size": {"x": 2, "y": 10.5, "z": 2},
                "translate": {"x": 0, "y": -5, "z": -3},
                "rot": [-Math.PI / 8, 0, 0],
                "faces": {
                    "down": {"uv": [8, 8], "flag": flag, "texture": log},
                    "north": {"uv": [8, 8], "flag": flag, "texture": log},
                    "south": {"uv": [8, 8], "flag": flag, "texture": log},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": log}
                }
            },{// ножка S
                "size": {"x": 2, "y": 10.5, "z": 2},
                "translate": {"x": -3, "y": -5, "z": 0},
                "rot": [0, 0, Math.PI / 8],
                "faces": {
                    "down": {"uv": [8, 8], "flag": flag, "texture": log},
                    "north": {"uv": [8, 8], "flag": flag, "texture": log},
                    "south": {"uv": [8, 8], "flag": flag, "texture": log},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": log}
                }
            },{// ножка N
                "size": {"x": 2, "y": 10.5, "z": 2},
                "translate": {"x": 3, "y": -5, "z": 0},
                "rot": [0, 0, -Math.PI / 8],
                "faces": {
                    "down": {"uv": [8, 8], "flag": flag, "texture": log},
                    "north": {"uv": [8, 8], "flag": flag, "texture": log},
                    "south": {"uv": [8, 8], "flag": flag, "texture": log},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": log}
                }
            }
        ]);
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;
        const cd = block.getCardinalDirection();
        matrix = mat4.create();
        mat4.rotateY(matrix, matrix, cd * Math.PI / 2);
        for(const part of parts) {
            default_style.pushAABB(vertices, {
                ...part,
                lm:         lm,
                pos:        pos,
                matrix:     matrix
            });
        }
    }
    
}