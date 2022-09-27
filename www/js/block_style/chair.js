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
            styles: ['chair'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(block, for_physic) {
        const cd = block.getCardinalDirection();
        const aabbs = [];
        aabbs.push(new AABB().set(0.125, 0, 0.0625, 0.875, 0.69, 0.938).rotate(cd, pivot));
        aabbs.push(new AABB().set(0.120, 0.69, 0.0625, 0.88, 1.62, 0.19).rotate(cd, pivot));
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
                "size": {"x": 12, "y": 3, "z": 12},
                "translate": {"x": 0, "y": 1.5, "z": 1},
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": log},
                    "down": {"uv": [8, 8], "flag": flag, "texture": log},
                    "north": {"uv": [8, 8], "flag": flag, "texture": log},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": log}
                }
            },{ // ножка S-W
                "size": {"x": 2, "y": 8, "z": 2},
                "translate": {"x": -5, "y": -4, "z": -6},
                "faces": {
                    "down": {"uv": [8, 8], "flag": flag, "texture": log},
                    "north": {"uv": [8, 8], "flag": flag, "texture": log},
                    "south": {"uv": [8, 8], "flag": flag, "texture": log},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": log}
                }
            },{ // ножка S-E
                "size": {"x": 2, "y": 8, "z": 2},
                "translate": {"x": 5, "y": -4, "z": -6},
                "faces": {
                    "down": {"uv": [8, 8], "flag": flag, "texture": log},
                    "north": {"uv": [8, 8], "flag": flag, "texture": log},
                    "south": {"uv": [8, 8], "flag": flag, "texture": log},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": log}
                }
            },{ // разделитель спинки и седенья
                "size": {"x": 12, "y": 3, "z": 2},
                "translate": {"x": 0, "y": 1.5, "z": -6},
                "faces": {
                    "down": {"uv": [8, 8], "flag": flag, "texture": log},
                    "south": {"uv": [8, 8], "flag": flag, "texture": log},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": log}
                }
            },{ // спинка
                "size": {"x": 12, "y": 15, "z": 2},
                "translate": {"x":0, "y": 10.5, "z": -6},
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": log},
                    "north": {"uv": [8, 8], "flag": flag, "texture": log},
                    "south": {"uv": [8, 8], "flag": flag, "texture": log},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": log}
                }
            },{ // ножка W-N
                "size": {"x": 2, "y": 8, "z": 2},
                "translate": {"x": -5, "y": -4, "z": 6},
                "faces": {
                    "down": {"uv": [8, 8], "flag": flag, "texture": log},
                    "north": {"uv": [8, 8], "flag": flag, "texture": log},
                    "south": {"uv": [8, 8], "flag": flag, "texture": log},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": log}
                }
            },{ // ножка E-N
                "size": {"x": 2, "y": 8, "z": 2},
                "translate": {"x": 5, "y": -4, "z": 6},
                "faces": {
                    "down": {"uv": [8, 8], "flag": flag, "texture": log},
                    "north": {"uv": [8, 8], "flag": flag, "texture": log},
                    "south": {"uv": [8, 8], "flag": flag, "texture": log},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": log}
                }
            },{ // перекладина W
                "size": {"x": 0, "y": 2, "z": 10},
                "translate": {"x": -5.5, "y": -3, "z": 0},
                "faces": {
                    "west":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": log}
                }
            },{ // перекладина E
                "size": {"x": 0, "y": 2, "z": 10},
                "translate": {"x": 5.5, "y": -3, "z": 0},
                "faces": {
                    "west":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": log}
                }
            },{ // перекладина N
                "size": {"x": 8, "y": 2, "z": 0},
                "translate": {"x": 0, "y": -3, "z": 6.5},
                "faces": {
                    "north":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "south":  {"uv": [8, 8], "flag": flag, "texture": log}
                }
            },{ // перекладина S
                "size": {"x": 8, "y": 2, "z": 0},
                "translate": {"x": 0, "y": -3, "z": -6.5},
                "faces": {
                    "north":  {"uv": [8, 8], "flag": flag, "texture": log},
                    "south":  {"uv": [8, 8], "flag": flag, "texture": log}
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