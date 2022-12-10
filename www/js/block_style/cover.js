import { DIRECTION, IndexedColor, QUAD_FLAGS } from '../helpers.js';
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
        if(block.extra_data) {
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
        } else if (block.rotate) {
            if (block.rotate.x == DIRECTION.SOUTH) {
                facets.push(new AABB().set(0, 0, 0.9, 1, 1, 1));
            } else if (block.rotate.x == DIRECTION.NORTH) {
                facets.push(new AABB().set(0, 0, 0, 1, 1, 0.1));
            } else if (block.rotate.x == DIRECTION.EAST) {
                facets.push(new AABB().set(0, 0, 0, 0.1, 1, 1));
            } else if (block.rotate.x == DIRECTION.WEST) {
                facets.push(new AABB().set(0.9, 0, 0, 1, 1, 1));
            }
        }
        return facets;
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {
        if(typeof block == 'undefined') {
            return;
        }
        const texture = block.material.texture;
        const tex_side = BLOCK.calcTexture(texture, DIRECTION.UP);
        let flags = 0;
        let lm = IndexedColor.WHITE;
        // Texture color multiplier
        if(block.id == BLOCK.VINE.id) {
            lm = dirt_color;
            flags = QUAD_FLAGS.MASK_BIOME;
        }
        // Рисуем грани блока
        if(block.extra_data) {
            if (block.extra_data.south) {
                plate(DIRECTION.SOUTH, vertices, tex_side, x, y, z, flags, lm);
            }
            if (block.extra_data.north) {
                plate(DIRECTION.NORTH, vertices, tex_side, x, y, z, flags, lm);
            }
            if (block.extra_data.west) {
                plate(DIRECTION.WEST, vertices, tex_side, x, y, z, flags, lm);
            }
            if (block.extra_data.east) {
                plate(DIRECTION.EAST, vertices, tex_side, x, y, z, flags, lm);
            }
            if (block.extra_data.down) {
                plate(DIRECTION.DOWN, vertices, tex_side, x, y, z, flags, lm, block.extra_data.rotate);
            }
            if (block.extra_data.up) {
                plate(DIRECTION.UP, vertices, tex_side, x, y, z, flags, lm, block.extra_data.rotate);
            }
        } else if(block.rotate) {
            plate(block.rotate.x, vertices, tex_side, x, y, z, flags, lm);
        }
    }
}

function plate(dir, vertices, texture, x, y, z, flags, lm, rot) {
    switch(dir) {
        case DIRECTION.DOWN:
            if (rot) {
                vertices.push( x + 0.5, z + 0.5, y + 0.98, 0, 1, 0, 1, 0, 0, texture[0], texture[1], texture[2], texture[3], lm.pack(), flags);
            } else {
                vertices.push( x + 0.5, z + 0.5, y + 0.98, 1, 0, 0, 0, -1, 0, texture[0], texture[1], texture[2], texture[3], lm.pack(), flags);
            }
            break;
        case DIRECTION.UP:
            if (rot) {
                vertices.push( x + 0.5, z + 0.5, y + 0.02, 0, 1, 0, -1, 0, 0, texture[0], texture[1], texture[2], texture[3], lm.pack(), flags);
            } else {
                vertices.push( x + 0.5, z + 0.5, y + 0.02, 1, 0, 0, 0, 1, 0, texture[0], texture[1], texture[2], texture[3], lm.pack(), flags);
            }
            break;
        case DIRECTION.SOUTH: 
            vertices.push( x + 0.5, z + 0.98, y + 0.5, 1, 0, 0, 0, 0, 1, texture[0], texture[1], texture[2], texture[3], lm.pack(), flags);
            break;
        case DIRECTION.NORTH: 
            vertices.push( x + 0.5, z + 0.02, y + 0.5, 1, 0, 0, 0, 0, -1, texture[0], texture[1], texture[2], texture[3], lm.pack(), flags);
            break;
        case DIRECTION.EAST: 
            vertices.push( x + 0.02, z + 0.5, y + 0.5, 0, 1, 0, 0, 0, 1, texture[0], texture[1], texture[2], texture[3], lm.pack(), flags);
            break;
        case DIRECTION.WEST: 
            vertices.push( x + 0.98, z + 0.5, y + 0.5, 0, 1, 0, 0, 0, -1, texture[0], texture[1], texture[2], texture[3], lm.pack(), flags);
            break;
    }
}