import {DIRECTION, QUAD_FLAGS, IndexedColor, Vector} from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { AABB } from '../core/AABB.js';
import { default as default_style } from './default.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;

// Наковальня
export default class style {
    
    static getRegInfo() {
        return {
            styles: ['lectern'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(block, for_physic) {
        if (for_physic) {
            return [new AABB().set(0, 0, 0, 1, 1, 1)]
        }
        const aabb = [];
        aabb.push(new AABB().set(0.25, 0.13, 0.25, 0.75, 0.94, 0.75));
        aabb.push(new AABB().set(0, 0, 0, 1, 0.13, 1));
        return aabb;
    }
    
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        if(!block || typeof block == 'undefined') {
            return;
        }
        
        const texture = block.material.texture;
        const up = BLOCK.calcTexture(texture, DIRECTION.UP);
        const side = BLOCK.calcTexture(texture, DIRECTION.WEST);
        const front = BLOCK.calcTexture(texture, DIRECTION.NORTH);
        const base = BLOCK.calcTexture(texture, DIRECTION.DOWN);
        const bottom = BLOCK.calcTexture(BLOCK.OAK_PLANKS.texture, DIRECTION.UP);
        const flag = 0;
        const parts = [];
        parts.push(...[
            {
                "size": {"x": 8, "y": 13, "z": 8},
                "translate": {"x": 0, "y": 0.5, "z": 0},
                "faces": {
                    "north": {"uv": [12, 8], "flag": flag, "texture": front},
                    "south": {"uv": [4, 8], "flag": flag, "texture": front},
                    "west":  {"uv": [4, 8], "flag": flag, "texture": side},
                    "east":  {"uv": [4, 8], "flag": flag, "texture": side}
                }
            },
            {
                "size": {"x": 16, "y": 2, "z": 16},
                "translate": {"x": 0, "y": -7, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": base},
                    "down": {"uv": [8, 8], "flag": flag, "texture": bottom},
                    "north": {"uv": [6, 1.5], "flag": flag, "texture": base},
                    "south": {"uv": [8, 12.5], "flag": flag, "texture": base},
                    "west":  {"uv": [6, 1.5], "flag": flag, "texture": base},
                    "east":  {"uv": [6, 1.5], "flag": flag, "texture": base}
                }
            },
            {
                "size": {"x": 16, "y": 4, "z": 13},
                "translate": {"x": 0, "y": 6, "z": 1.5},
                "faces": {
                    "up": { "uv": [8, 8], "flag": flag, "texture": up},
                    "north": {"uv": [12, 8], "flag": flag, "texture": side},
                    "south": {"uv": [8, 8], "flag": flag, "texture": side},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": side},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": side}
                },
                "rot": [Math.PI / 12, 0, 0]
            }
        ]);
        const cd = block.getCardinalDirection();
        matrix = mat4.create();
        switch(cd) {
            case DIRECTION.NORTH: 
                mat4.rotateY(matrix, matrix, Math.PI);
                break;
            case DIRECTION.WEST: 
                mat4.rotateY(matrix, matrix, -Math.PI / 2);
                break;
            case DIRECTION.EAST: 
                mat4.rotateY(matrix, matrix, Math.PI / 2);
                break;
        }
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;
        for(let part of parts) {
            default_style.pushAABB(vertices, {
                ...part,
                lm:         lm,
                pos:        pos,
                matrix:     matrix
            });
        }
        
        drawBook(vertices, pos, matrix);
        
    }
    
}

function drawBook(vertices, pos, matrix) {
    const book = BLOCK.calcTexture({'up':[24, 24]}, DIRECTION.UP);
    const flag = 0;
    const parts = [];
    parts.push(...[
        {
            "size": {"x": 6, "y": 1, "z": 10},
            "translate": {"x": -3, "y": 8, "z": 1},
            "faces": {
                "up": {"uv": [3, 5], "flag": flag, "texture": book}
            },
            "rot": [Math.PI / 12, 0, 0]
        }, 
        {
            "size": {"x": 6, "y": 1, "z": 10},
            "translate": {"x": 3, "y": 8, "z": 1},
            "faces": {
                "up": {"uv": [19, 5], "flag": flag, "texture": book}
            },
            "rot": [Math.PI / 12, 0, 0]
        },
        {
            "size": {"x": 11, "y": 0.5, "z": 8},
            "translate": {"x": 0, "y": 9, "z": 1},
            "faces": {
                "up": {"uv": [6.5, 15], "flag": flag, "texture": book},
                "north": {"uv": [6.5, 12], "flag": flag, "texture": book},
                "south": {"uv": [6.5, 12], "flag": flag, "texture": book},
                "west": {"uv": [6.5, 18], "flag": flag, "texture": book},
                "east": {"uv": [6.5, 18], "flag": flag, "texture": book}
            },
            "rot": [Math.PI / 12, 0, 0]
        }
    ]);
          
    const lm = IndexedColor.WHITE;
    for(let part of parts) {
        default_style.pushAABB(vertices, {
            ...part,
            lm:         lm,
            pos:        pos,
            matrix:     matrix
        });
    }
}