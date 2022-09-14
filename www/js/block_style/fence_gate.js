import {DIRECTION, IndexedColor} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {AABB} from '../core/AABB.js';

const SIZE = 1 / 16;

// Калитка
export default class style {

    static getRegInfo() {
        return {
            styles: ['fence_gate'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {
        let aabb = new AABB();
        const cardinal_direction = block.getCardinalDirection();
        if (!for_physic) {
            if (cardinal_direction == DIRECTION.WEST || cardinal_direction == DIRECTION.EAST) {
                aabb.set(6 * SIZE, 4 * SIZE, 0, 10 * SIZE, 16 * SIZE, 16 * SIZE);
            } else {
                aabb.set(0, 4 * SIZE, 6 * SIZE, 16 * SIZE, 16 * SIZE, 10 * SIZE);
            }
        } else {
            if (!block.extra_data.opened) {
                if (cardinal_direction == DIRECTION.WEST || cardinal_direction == DIRECTION.EAST) {
                    aabb.set(6 * SIZE, 0, 0, 10 * SIZE, 25 * SIZE, 16 * SIZE);
                } else {
                    aabb.set(0, 0, 6 * SIZE, 16 * SIZE, 25 * SIZE, 10 * SIZE);
                }
            }
        }
        return [aabb];
    }

    //
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        const texture = BLOCK.calcTexture(block.material.texture, DIRECTION.FORWARD);

        const cardinal_direction = block.getCardinalDirection();

        if (cardinal_direction == DIRECTION.WEST || cardinal_direction == DIRECTION.EAST) {
            // Столбы
            push_part(vertices, texture, x + 8 * SIZE, y + 4 * SIZE, z + SIZE, 2 * SIZE, 2 * SIZE, 12 * SIZE);
            push_part(vertices, texture, x + 8 * SIZE, y + 4 * SIZE, z + 15 * SIZE, 2 * SIZE, 2 * SIZE, 12 * SIZE);
            // Створки
            if (block.extra_data.opened) {
                if (['east', 'north'].indexOf(block.extra_data.facing) >= 0) {
                    push_half_gate(DIRECTION.FORWARD, x + 8 * SIZE, y,  z + SIZE, vertices, texture);
                    push_half_gate(DIRECTION.FORWARD, x + 8 * SIZE, y,  z + 15 * SIZE, vertices, texture);
                } else {
                    push_half_gate(DIRECTION.BACK, x + 8 * SIZE, y,  z + SIZE, vertices, texture);
                    push_half_gate(DIRECTION.BACK, x + 8 * SIZE, y,  z + 15 * SIZE, vertices, texture);
                }
            } else {
                push_half_gate(DIRECTION.RIGHT, x + 8 * SIZE, y,  z + SIZE, vertices, texture);
                push_half_gate(DIRECTION.LEFT, x + 8 * SIZE, y,  z + 15 * SIZE, vertices, texture);
            }
        } else {
            // Столбы
            push_part(vertices, texture, x + SIZE, y + 4 * SIZE, z + 8 * SIZE, 2 * SIZE, 2 * SIZE, 12 * SIZE);
            push_part(vertices, texture, x + 15 * SIZE, y + 4 * SIZE, z + 8 * SIZE, 2 * SIZE, 2 * SIZE, 12 * SIZE);
            // Створки
            if (block.extra_data?.opened) {
                if (['east', 'north'].includes(block.extra_data?.facing)) {
                    push_half_gate(DIRECTION.RIGHT, x + SIZE, y,  z + 8 * SIZE, vertices, texture);
                    push_half_gate(DIRECTION.RIGHT, x + 15 * SIZE, y,  z + 8 * SIZE, vertices, texture);
                } else {
                    push_half_gate(DIRECTION.LEFT, x + SIZE, y,  z + 8 * SIZE, vertices, texture);
                    push_half_gate(DIRECTION.LEFT, x + 15 * SIZE, y,  z + 8 * SIZE, vertices, texture);
                }
            } else {
                push_half_gate(DIRECTION.FORWARD, x + SIZE, y,  z + 8 * SIZE, vertices, texture);
                push_half_gate(DIRECTION.BACK, x + 15 * SIZE, y,  z + 8 * SIZE, vertices, texture);
            }
        }

    }

}

function push_half_gate(orientation, x, y, z, vertices, tex) {
    switch(orientation) {
        case DIRECTION.BACK: {
            push_part(vertices, tex, x - 4 * SIZE, y + 6 * SIZE, z, 6 * SIZE, 2 * SIZE, 2 * SIZE);
            push_part(vertices, tex, x - 4 * SIZE, y + 12 * SIZE, z, 6 * SIZE, 2 * SIZE, 2 * SIZE);
            push_part(vertices, tex, x - 6 * SIZE, y + 8 * SIZE, z , 2 * SIZE, 2 * SIZE, 4 * SIZE);
            break;
        }
        case DIRECTION.RIGHT: {
            push_part(vertices, tex, x, y + 6 * SIZE, z + 4 * SIZE, 2 * SIZE, 6 * SIZE, 2 * SIZE);
            push_part(vertices, tex, x, y + 12 * SIZE, z + 4 * SIZE, 2 * SIZE, 6 * SIZE, 2 * SIZE);
            push_part(vertices, tex, x, y + 8 * SIZE, z + 6 * SIZE, 2 * SIZE, 2 * SIZE, 4 * SIZE);
            break;
        }
        case DIRECTION.LEFT: {
            push_part(vertices, tex, x, y + 6 * SIZE, z - 4 * SIZE, 2 * SIZE, 6 * SIZE, 2 * SIZE);
            push_part(vertices, tex, x, y + 12 * SIZE, z - 4 * SIZE, 2 * SIZE, 6 * SIZE, 2 * SIZE);
            push_part(vertices, tex, x, y + 8 * SIZE, z - 6 * SIZE, 2 * SIZE, 2 * SIZE, 4 * SIZE);
            break;
        }
        default: {
            push_part(vertices, tex, x + 4 * SIZE, y + 6 * SIZE, z, 6 * SIZE, 2 * SIZE, 2 * SIZE);
            push_part(vertices, tex, x + 4 * SIZE, y + 12 * SIZE, z, 6 * SIZE, 2 * SIZE, 2 * SIZE);
            push_part(vertices, tex, x + 6 * SIZE, y + 8 * SIZE, z, 2 * SIZE, 2 * SIZE, 4 * SIZE);
            break;
        }
    }
}

function push_part(vertices, c, x, y, z, xs, zs, h) {
    let pp          = IndexedColor.WHITE.packed;
    let flags       = 0;
    let sideFlags   = 0;
    let upFlags     = 0;
    // TOP
    vertices.push(x, z, y + h,
        xs, 0, 0,
        0, zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        pp, flags | upFlags);
    // BOTTOM
    vertices.push(x, z, y,
        xs, 0, 0,
        0, -zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        pp, flags);
    // SOUTH
    vertices.push(x, z - zs/2, y + h/2,
        xs, 0, 0,
        0, 0, h,
        c[0], c[1], c[2]*xs, -c[3]*h,
        pp, flags | sideFlags);
    // NORTH
    vertices.push(x, z + zs/2, y + h/2,
        xs, 0, 0,
        0, 0, -h,
        c[0], c[1], -c[2]*xs, c[3]*h,
        pp, flags | sideFlags);
    // WEST
    vertices.push(x - xs/2, z, y + h/2,
        0, zs, 0,
        0, 0, -h,
        c[0], c[1], -c[2]*zs, c[3]*h,
        pp, flags | sideFlags);
    // EAST
    vertices.push(x + xs/2, z, y + h/2,
        0, zs, 0,
        0, 0, h,
        c[0], c[1], c[2]*zs, -c[3]*h,
        pp, flags | sideFlags);
}