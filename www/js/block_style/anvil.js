import { MULTIPLY, DIRECTION } from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { AABB } from '../core/AABB.js';
import { RailShape } from '../block_type/rail_shape.js';

// Накавальня
export default class style {
    static getRegInfo() {
        return {
            styles: ['anvil'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(block, for_physic) {
        const aabb = new AABB();
        aabb.set(0.12, 0, 0, 0.88, 1, 1);
        return [aabb];
    }
    
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {
        if(typeof block == 'undefined') {
            return;
        }
        
        const texture = block.material.texture;
        const side = BLOCK.calcTexture(texture, DIRECTION.WEST);
        let up = side;
        if (block.extra_data.damage == 1) {
            up = BLOCK.calcTexture(texture, DIRECTION.NORTH);
        } else if (block.extra_data.damage == 2) {
            up = BLOCK.calcTexture(texture, DIRECTION.SOUTH);
        }
        
        box(16, 10, 6, 10, vertices, side, up, x, y, z);
        box(8, 3, 5, 5, vertices, side, side, x, y, z);
        box(10, 8, 1, 4, vertices, side, side, x, y, z);
        box(12, 12, 4, 0, vertices, side, side, x, y, z);
    }
    
    

}

function box(width, length, height, shift, vertices, texture, texture_up, x, y, z) {
    width = width / 16;
    shift = shift / 16;
    height = height / 16;
    length = length / 16;
    const lm = MULTIPLY.COLOR.WHITE;
    const flags = 0;
    vertices.push( x + 0.5, z + 0.5 - width / 2, y + shift + height / 2, length, 0, 0, 0, 0, height, texture[0], texture[1], texture[2] * length, texture[3] * height, lm.r, lm.g, lm.b, flags);
    vertices.push( x + 0.5, z + 0.5 + width / 2, y + shift + height / 2, length, 0, 0, 0, 0, -height, texture[0], texture[1], texture[2] * length, texture[3] * height, lm.r, lm.g, lm.b, flags);
    vertices.push( x + 0.5 - length / 2, z + 0.5, y + shift + height / 2, 0, width, 0, 0, 0, -height, texture[0], texture[1], texture[2] * width, texture[3] * height, lm.r, lm.g, lm.b, flags);
    vertices.push( x + 0.5 + length / 2, z + 0.5, y + shift + height / 2, 0, width, 0, 0, 0, height, texture[0], texture[1], texture[2] * width, texture[3] * height, lm.r, lm.g, lm.b, flags);
    vertices.push( x + 0.5, z + 0.5, y + shift, length, 0, 0, 0, -width, 0, texture[0], texture[1], texture[2] * length, texture[3] * width, lm.r, lm.g, lm.b, flags);
    vertices.push( x + 0.5, z + 0.5, y + shift + height, length, 0, 0, 0, width, 0, texture_up[0], texture_up[1], texture_up[2] * length, texture_up[3] * width, lm.r, lm.g, lm.b, flags);
}