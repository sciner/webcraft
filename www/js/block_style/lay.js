import { DIRECTION, IndexedColor } from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { AABB } from '../core/AABB.js';


// Лестница
export default class style {

    static getRegInfo() {
        return {
            styles: ['lay'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(block, for_physic) {
        const aabb = new AABB();
        const cd = block.getCardinalDirection();
        if (cd != 0) {
            aabb.set(0, 0, 0, 0.06, 1, 1);
        } else {
            aabb.set(0, 0, 0, 1, 1, 0.06);
        }
        return [aabb];
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {

        if(typeof block == 'undefined') {
            return;
        }
        const texture = block.material.texture;
        const side = BLOCK.calcTexture(texture, DIRECTION.UP);
        
        const lm = IndexedColor.WHITE;
        const flags = 0;
        const cd = block.getCardinalDirection();
        console.log(cd);
        vertices.push( x, z, y, 1, 0, 0, 0, 0, 1, side[0], side[1], side[2], side[3], lm.pack(), flags);
    }

}