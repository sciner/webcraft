import { DIRECTION, IndexedColor, QUAD_FLAGS } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import type { BlockManager } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';

// поверхность
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['cover'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    static computeAABB(tblock : TBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        if (for_physic) {
            return [];
        }
        const shapes = [];
        if(tblock.extra_data) {
            if (tblock.extra_data.south) {
                shapes.push(new AABB().set(0, 0, 0.9, 1, 1, 1));
            }
            if (tblock.extra_data.north) {
                shapes.push(new AABB().set(0, 0, 0, 1, 1, 0.1));
            }
            if (tblock.extra_data.east) {
                shapes.push(new AABB().set(0, 0, 0, 0.1, 1, 1));
            }
            if (tblock.extra_data.west) {
                shapes.push(new AABB().set(0.9, 0, 0, 1, 1, 1));
            }
            if (tblock.extra_data.down) {
                shapes.push(new AABB().set(0, 0.9, 0, 1, 1, 1));
            }
            if (tblock.extra_data.up) {
                shapes.push(new AABB().set(0, 0, 0, 1, 0.1, 1));
            }
        } else if (tblock.rotate) {
            if (tblock.rotate.x == DIRECTION.SOUTH) {
                shapes.push(new AABB().set(0, 0, 0.9, 1, 1, 1));
            } else if (tblock.rotate.x == DIRECTION.NORTH) {
                shapes.push(new AABB().set(0, 0, 0, 1, 1, 0.1));
            } else if (tblock.rotate.x == DIRECTION.EAST) {
                shapes.push(new AABB().set(0, 0, 0, 0.1, 1, 1));
            } else if (tblock.rotate.x == DIRECTION.WEST) {
                shapes.push(new AABB().set(0.9, 0, 0, 1, 1, 1));
            }
        }
        if(shapes.length == 0) {
            shapes.push(new AABB(0, 0, 0, 1, 1, 1))
        }
        return shapes;
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {
        if(typeof block == 'undefined') {
            return;
        }
        const bm = style.block_manager
        const texture = block.material.texture;
        const tex_side = bm.calcTexture(texture, DIRECTION.UP);
        let flags = 0;
        let lm = IndexedColor.WHITE;
        // Texture color multiplier
        if(block.id == bm.VINE.id) {
            lm = dirt_color;
            flags = QUAD_FLAGS.FLAG_MASK_COLOR_ADD;
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
                plate(DIRECTION.DOWN, vertices, tex_side, x, y, z, flags, lm, !!block.extra_data.rotate);
            }
            if (block.extra_data.up) {
                plate(DIRECTION.UP, vertices, tex_side, x, y, z, flags, lm, !!block.extra_data.rotate);
            }
        } else if(block.rotate) {
            plate(block.rotate.x, vertices, tex_side, x, y, z, flags, lm);
        }
    }
}

function plate(dir : int, vertices, texture, x, y, z, flags : int, lm : IndexedColor, rot : boolean = false) {
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