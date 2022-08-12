import { DIRECTION, IndexedColor, QUAD_FLAGS } from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { AABB } from '../core/AABB.js';

// Наковальня
export default class style {
    
    static getRegInfo() {
        return {
            styles: ['beacon'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(block, for_physic) {
        const aabb = new AABB();
        aabb.set(0, 0, 0, 1, 1, 1);
        return [aabb];
    }
    
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {
        if(typeof block == 'undefined') {
            return;
        }
        
        const texture = block.material.texture;
        const beacon = BLOCK.calcTexture(texture, DIRECTION.UP);
        const side = BLOCK.calcTexture(texture, DIRECTION.WEST);
        const obsidian = BLOCK.calcTexture(texture, DIRECTION.DOWN);
        const beam = BLOCK.calcTexture(texture, DIRECTION.NORTH);
  
        box(16, 16, 16, 0, vertices, side, side, x, y, z);
        box(12, 12, 2, 0, vertices, obsidian, obsidian, x, y, z);
        box(10, 10, 11, 2, vertices, beacon, beacon, x, y, z);
       // box(8, 3, 5, 5, cd, vertices, side, side, x, y, z);
       // box(10, 8, 1, 4, cd, vertices, side, side, x, y, z);
       // box(12, 12, 4, 0, cd, vertices, side, side, x, y, z);
       
       // const lm = new IndexedColor(255, 255, 0);
        const lm        = new IndexedColor(0, 10, 0);
        const flags = QUAD_FLAGS.NO_CAN_TAKE_LIGHT | QUAD_FLAGS.FLAG_TEXTURE_SCROLL;

        vertices.push( x, z, y + 1, 1, 0, 0, 0, 0, 1, 0, beam[1], beam[2], beam[3], lm.pack(), flags);
    
    }
    
}

function box(width, length, height, shift, vertices, texture, texture_up, x, y, z) {
    width /= 16;
    shift /= 16;
    height /= 16;
    length /= 16;
    const lm = IndexedColor.WHITE;
    const flags = 0;

    vertices.push( x + 0.5, z + 0.5 - width / 2, y + shift + height / 2, length, 0, 0, 0, 0, height, texture[0], texture[1], texture[2] * length, texture[3] * height, lm.pack(), flags);
    vertices.push( x + 0.5, z + 0.5 + width / 2, y + shift + height / 2, length, 0, 0, 0, 0, -height, texture[0], texture[1], texture[2] * length, texture[3] * height, lm.pack(), flags);
    vertices.push( x + 0.5 - length / 2, z + 0.5, y + shift + height / 2, 0, width, 0, 0, 0, -height, texture[0], texture[1], texture[2] * width, texture[3] * height, lm.pack(), flags);
    vertices.push( x + 0.5 + length / 2, z + 0.5, y + shift + height / 2, 0, width, 0, 0, 0, height, texture[0], texture[1], texture[2] * width, texture[3] * height, lm.pack(), flags);
    vertices.push( x + 0.5, z + 0.5, y + shift, length, 0, 0, 0, -width, 0, texture[0], texture[1], texture[2] * length, texture[3] * width, lm.pack(), flags);
    vertices.push( x + 0.5, z + 0.5, y + shift + height, length, 0, 0, 0, width, 0, texture_up[0], texture_up[1], texture_up[2] * length, texture_up[3] * width, lm.pack(), flags);
}