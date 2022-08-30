import {DIRECTION, QUAD_FLAGS, IndexedColor, Vector} from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { AABB } from '../core/AABB.js';
import { default as default_style } from './default.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;

// точильный камень
export default class style {
    
    static getRegInfo() {
        return {
            styles: ['armor_stand'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(block, for_physic) {
        const aabb = new AABB();
        aabb.set(0.12, 0, 0.12, 0.88, 1, 0.88);
        return [aabb];
    }
    
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        if(!block || typeof block == 'undefined') {
            return;
        }
        
        const planks = BLOCK.calcTexture(BLOCK.DARK_OAK_LOG.texture, DIRECTION.UP);
        const flag = 0;
        const parts = [];
        parts.push(...[
            {
                "size": {"x": 2, "y": 7, "z": 4},
                "translate": {"x": 5, "y": -4.5, "z": 0},
                "faces": {
                    "down": {"uv": [12, 9], "flag": flag, "texture": planks},
                    "north": {"uv": [12, 9], "flag": flag, "texture": planks},
                    "south": {"uv": [4, 8], "flag": flag, "texture": planks},
                    "west":  {"uv": [12, 9], "flag": flag, "texture": planks},
                    "east":  {"uv": [12, 9], "flag": flag, "texture": planks}
                }
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