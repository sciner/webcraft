import { IndexedColor, DIRECTION } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { RailShape } from '../block_type/rail_shape.js';
import type { BlockManager } from '../blocks.js';

// Рельсы
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['rails'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    static computeAABB(block, for_physic) {
        if(for_physic) {
            return [];
        }
        const aabb = new AABB();
        if (RailShape.isTilted(block.extra_data.shape)) {
            aabb.set(0, 0, 0, 1, 0.5, 1);
            return [aabb];
        } else {
            aabb.set(0, 0, 0, 1, 4/32, 1);
            return [aabb];
        }
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {

        if(typeof block == 'undefined') {
            return;
        }

        const bm = style.block_manager
        const texture = block.material.texture;

        // Рисуем блок
        switch(block.extra_data?.shape ?? RailShape.NORTH_SOUTH) {
            case RailShape.NORTH_SOUTH: {
                plate(vertices, bm.calcTexture(texture, DIRECTION.UP), x, y, z, DIRECTION.NORTH);
                break;
            }
            case RailShape.EAST_WEST: {
                plate(vertices, bm.calcTexture(texture, DIRECTION.UP), x, y, z, DIRECTION.WEST);
                break;
            }
            case RailShape.NORTH_EAST: {
                plate(vertices, bm.calcTexture(texture, DIRECTION.DOWN), x, y, z, DIRECTION.SOUTH);
                break;
            }
            case RailShape.NORTH_WEST: {
                plate(vertices, bm.calcTexture(texture, DIRECTION.DOWN), x, y, z, DIRECTION.EAST);
                break;
            }
            case RailShape.SOUTH_WEST: {
                plate(vertices, bm.calcTexture(texture, DIRECTION.DOWN), x, y, z, DIRECTION.NORTH);
                break;
            }
            case RailShape.SOUTH_EAST: {
                plate(vertices, bm.calcTexture(texture, DIRECTION.DOWN), x, y, z, DIRECTION.WEST);
                break;
            }
            case RailShape.ASCENDING_NORTH: {
                plate(vertices, bm.calcTexture(texture, DIRECTION.UP), x, y, z, DIRECTION.NORTH, DIRECTION.UP, true);
                break;
            }
            case RailShape.ASCENDING_SOUTH: {
                plate(vertices, bm.calcTexture(texture, DIRECTION.UP), x, y, z, DIRECTION.SOUTH, DIRECTION.UP, true);
                break;
            }
            case RailShape.ASCENDING_WEST: {
                plate(vertices, bm.calcTexture(texture, DIRECTION.UP), x, y, z, DIRECTION.WEST, DIRECTION.UP, true);
                break;
            }
            case RailShape.ASCENDING_EAST: {
                plate(vertices, bm.calcTexture(texture, DIRECTION.UP), x, y, z, DIRECTION.EAST, DIRECTION.UP, true);
                break;
            }
            default: {
                plate(vertices, bm.calcTexture(texture, DIRECTION.DOWN), x, y, z, DIRECTION.NORTH);
            }
        }

    }

}

function plate(vertices, c, x, y, z, rot = 0, dir = 0, back = false) {

    const pp = IndexedColor.WHITE.packed;
    const flags = 0;

    const h = (dir == DIRECTION.UP || dir == DIRECTION.DOWN) ? 0.5 : 0.02;

    let d = 0;
    if (dir == DIRECTION.UP) {
        d = -1;
    } else if (dir == DIRECTION.DOWN) {
        d = 1;
    }

    switch(rot) {
        case DIRECTION.SOUTH: {
            vertices.push( x + 0.5, z + 0.5, y + h, 1, 0, 0, 0, 1, d, c[0], c[1], c[2], c[3], pp, flags);
            break;
        }
        case DIRECTION.EAST: {
            vertices.push( x + 0.5, z + 0.5, y + h, 0, 1, 0, -1, 0, d, c[0], c[1], c[2], c[3], pp, flags);
            break;
        }
        case DIRECTION.WEST: {
            vertices.push( x + 0.5, z + 0.5, y + h, 0, -1, 0, 1, 0, d, c[0], c[1], c[2], c[3], pp, flags);
            break;
        }
        default: {
            vertices.push( x + 0.5, z + 0.5, y + h, -1, 0, 0, 0, -1, d, c[0], c[1], c[2], c[3], pp, flags);
        }
    }

}