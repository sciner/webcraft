import { DIRECTION, IndexedColor } from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { AABB } from '../core/AABB.js';

// поверхность
export default class style {

    static getRegInfo() {
        return {
            styles: ['cover'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(block, for_physic) {
        if (for_physic) {
            return [];
        }
        const facets = [];
        if (block.extra_data.south) {
            facets.push(new AABB().set(0, 0, 0.9, 1, 1, 1));
        }
        if (block.extra_data.north) {
            facets.push(new AABB().set(0, 0, 0, 1, 1, 0.1));
        }
        if (block.extra_data.east) {
            facets.push(new AABB().set(0, 0, 0, 0.1, 1, 1));
        }
        if (block.extra_data.west) {
            facets.push(new AABB().set(0.9, 0, 0, 1, 1, 1));
        }
        if (block.extra_data.down) {
            facets.push(new AABB().set(0, 0.9, 0, 1, 1, 1));
        }
        if (block.extra_data.up) {
            facets.push(new AABB().set(0, 0, 0, 1, 0.1, 1));
        }
        return facets;
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {
        if(typeof block == 'undefined') {
            return;
        }
        const texture = block.material.texture;
        const side = BLOCK.calcTexture(texture, DIRECTION.UP);
        // Рисуем грани блока
        if (block.extra_data.south) {
            plate(DIRECTION.SOUTH, vertices, side, x, y, z);
        }
        if (block.extra_data.north) {
            plate(DIRECTION.NORTH, vertices, side, x, y, z);
        }
        if (block.extra_data.west) {
            plate(DIRECTION.WEST, vertices, side, x, y, z);
        }
        if (block.extra_data.east) {
            plate(DIRECTION.EAST, vertices, side, x, y, z);
        }
        if (block.extra_data.down) {
            plate(DIRECTION.DOWN, vertices, side, x, y, z);
        }
        if (block.extra_data.up) {
            plate(DIRECTION.UP, vertices, side, x, y, z);
        }
    }
}

function plate(dir, vertices, texture, x, y, z) {
    const lm = IndexedColor.WHITE;
    const flags = 0;
    switch(dir) {
        case DIRECTION.UP:
            vertices.push( x + 0.5, z + 0.5, y + 0.001, 1, 0, 0, 0, 1, 0, texture[0], texture[1], texture[2], texture[3], lm.pack(), flags);
            break;
        case DIRECTION.SOUTH: 
            vertices.push( x + 0.5, z + 0.999, y + 0.5, 1, 0, 0, 0, 0, 1, texture[0], texture[1], texture[2], texture[3], lm.pack(), flags);
            break;
        case DIRECTION.NORTH: 
            vertices.push( x + 0.5, z + 0.001, y + 0.5, 1, 0, 0, 0, 0, -1, texture[0], texture[1], texture[2], texture[3], lm.pack(), flags);
            break;
        case DIRECTION.EAST: 
            vertices.push( x + 0.001, z + 0.5, y + 0.5, 0, 1, 0, 0, 0, 1, texture[0], texture[1], texture[2], texture[3], lm.pack(), flags);
            break;
        case DIRECTION.WEST: 
            vertices.push( x + 0.999, z + 0.5, y + 0.5, 0, 1, 0, 0, 0, -1, texture[0], texture[1], texture[2], texture[3], lm.pack(), flags);
            break;
        default:
            vertices.push( x + 0.5, z + 0.5, y + 0.999, 1, 0, 0, 0, -1, 0, texture[0], texture[1], texture[2], texture[3], lm.pack(), flags);
    }
}