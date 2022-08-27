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
        const aabb = [];
        aabb.push(new AABB().set(0.25, 0.13, 0.25, 0.75, 0.94, 0.75));
        aabb.push(new AABB().set(0, 0, 0, 1, 0.13, 1));
        return aabb;
    }
    
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        if(typeof block == 'undefined') {
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
        
        
    }
    
}