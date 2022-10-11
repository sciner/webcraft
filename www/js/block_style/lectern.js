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
        const aabb = new AABB();
        aabb.set(0, 0, 0, 1, 1, 1);
        return [aabb];
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
                    "north": {"uv": [12, 9], "flag": flag, "texture": front},
                    "south": {"uv": [4, 8], "flag": flag, "texture": front},
                    "west":  {"uv": [12, 9], "flag": flag, "texture": front},
                    "east":  {"uv": [12, 9], "flag": flag, "texture": front}
                }
            },
            {
                "size": {"x": 16, "y": 2, "z": 16},
                "translate": {"x": 0, "y": -7, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": base},
                    "down": {"uv": [8, 8], "flag": flag, "texture": bottom},
                    "north": {"uv": [6, 1.5], "flag": flag, "texture": base},
                    "south": {"uv": [8, 13], "flag": flag, "texture": base},
                    "west":  {"uv": [6, 1.5], "flag": flag, "texture": base},
                    "east":  {"uv": [6, 1.5], "flag": flag, "texture": base}
                }
            },
            {
                "size": {"x": 16, "y": 4, "z": 13},
                "translate": {"x": 0, "y": 6, "z": 1.5},
                "faces": {
                    "up": { "uv": [8, 8], "flag": flag, "texture": up},
                    "down": {"uv": [8, 8], "flag": flag, "texture": bottom},
                    "north": {"uv": [8, 8], "flag": flag, "texture": bottom},
                    "south": {"uv": [8, 2], "flag": flag, "texture": [up[0], up[1], up[2], up[3] * -1]},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": bottom},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": bottom}
                },
                "rot": [-Math.PI / 12, 0, 0]
            }
        ]);
        const cd = block.getCardinalDirection();
        matrix = mat4.create();
        switch(cd) {
            case DIRECTION.NORTH: 
                mat4.rotateY(matrix, matrix, Math.PI);
                break;
            case DIRECTION.WEST: 
                mat4.rotateY(matrix, matrix, Math.PI / 2);
                break;
            case DIRECTION.EAST: 
                mat4.rotateY(matrix, matrix, -Math.PI / 2);
                break;
        }
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;
        for(let part of parts) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         lm,
                pos:        pos,
                matrix:     matrix
            });
        }
        
        if(block.extra_data?.book) {
            drawBook(vertices, pos, matrix);
        }
        
    }
    
}

function drawBook(vertices, pos, matrix) {
    const book = BLOCK.calcTexture({'up':[24, 24]}, DIRECTION.UP);
    const flag = 0;
    const parts = [];
    parts.push(...[
        {
            "size": {"x": 6, "y": 1, "z": 10},
            "translate": {"x": -3.7, "y": 7.6, "z": 1},
            "faces": {
                "up": {"uv": [3, 5], "flag": flag, "texture": book}
            },
            "rot": [-Math.PI / 12, Math.PI / 140, -Math.PI / 36]
        }, 
        {
            "size": {"x": 6, "y": 1, "z": 10},
            "translate": {"x": 3.7, "y": 7.6, "z": 1},
            "faces": {
                "up": {"uv": [19, 5], "flag": flag, "texture": book}
            },
            "rot": [-Math.PI / 12, -Math.PI / 140, Math.PI / 36]
        },
        {
            "size": {"x": 5, "y": 1, "z": 8},
            "translate": {"x": -3.3, "y": 8.6, "z": 1},
            "faces": {
                "up": {"uv": [3.5, 15], "flag": flag, "texture": book},
                "north": {"uv": [3.5, 10.5], "flag": flag, "texture": book},
                "south": {"uv": [3.5, 10.5], "flag": flag, "texture": book},
                "west": {"uv": [5, 10.5], "flag": flag, "texture": book},
                "east": {"uv": [5, 10.5], "flag": flag, "texture": book}
            },
            "rot": [-Math.PI / 12, Math.PI / 140, -Math.PI / 36]
        },
        {
            "size": {"x": 5, "y": 1, "z": 8},
            "translate": {"x": 3.3, "y": 8.6, "z": 1},
            "faces": {
                "up": {"uv": [3.5, 15], "flag": flag, "texture": book},
                "north": {"uv": [3.5, 10.5], "flag": flag, "texture": book},
                "south": {"uv": [3.5, 10.5], "flag": flag, "texture": book},
                "west": {"uv": [5, 10.5], "flag": flag, "texture": book},
                "east": {"uv": [5, 10.5], "flag": flag, "texture": book}
            },
            "rot": [-Math.PI / 12, -Math.PI / 140, Math.PI / 36]
        }
    ]);
          
    const lm = IndexedColor.WHITE;
    for(let part of parts) {
        default_style.pushPART(vertices, {
            ...part,
            lm:         lm,
            pos:        pos,
            matrix:     matrix
        });
    }
}