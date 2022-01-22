import {DIRECTION, MULTIPLY} from '../helpers.js';
import {BLOCK} from "../blocks.js";

const CENTER_WIDTH = 8 / 16;
const CONNECT_WIDTH = 6 / 16;
const CONNECT_HEIGHT = 14 / 16;
const CONNECT_BOTTOM = 0 / 16;

const fake_neighbour = {
    id: 1,
    properties: {
        transparent: false,
        style: 'wall'
    }
}

// Забор
export default class style {

    static getRegInfo() {
        return {
            styles: ['wall'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        // Texture
        const c = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);

        push_part(vertices, c, x + .5, y, z + .5, CENTER_WIDTH, CENTER_WIDTH, 1);

        // South
        if(BLOCK.canWallConnect(neighbours.SOUTH)) {
            push_part(vertices, c, x + .5, y + CONNECT_BOTTOM, z + .5 - 5/16, CONNECT_WIDTH, 6/16, CONNECT_HEIGHT);
        }
        // North
        if(BLOCK.canWallConnect(neighbours.NORTH)) {
            push_part(vertices, c, x + .5, y + CONNECT_BOTTOM, z + .5 + 5/16, CONNECT_WIDTH, 6/16, CONNECT_HEIGHT);
        }
        // West
        if(BLOCK.canWallConnect(neighbours.WEST)) {
            push_part(vertices, c, x + .5 - 5/16, y + CONNECT_BOTTOM, z + .5, 6/16, CONNECT_WIDTH, CONNECT_HEIGHT);
        }
        // East
        if(BLOCK.canWallConnect(neighbours.EAST)) {
            push_part(vertices, c, x + .5 + 5/16, y + CONNECT_BOTTOM, z + .5, 6/16, CONNECT_WIDTH, CONNECT_HEIGHT);
        }

    }

}

function push_part(vertices, c, x, y, z, xs, zs, h) {
    let lm          = MULTIPLY.COLOR.WHITE;
    let flags       = 0;
    let sideFlags   = 0;
    let upFlags     = 0;
    // TOP
    vertices.push(x, z, y + h,
        xs, 0, 0,
        0, zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        lm.r, lm.g, lm.b, flags | upFlags);
    // BOTTOM
    vertices.push(x, z, y,
        xs, 0, 0,
        0, -zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        lm.r, lm.g, lm.b, flags);
    // SOUTH
    vertices.push(x, z - zs/2, y + h/2,
        xs, 0, 0,
        0, 0, h,
        c[0], c[1], c[2]*xs, -c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
    // NORTH
    vertices.push(x, z + zs/2, y + h/2,
        xs, 0, 0,
        0, 0, -h,
        c[0], c[1], -c[2]*xs, c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
    // WEST
    vertices.push(x - xs/2, z, y + h/2,
        0, zs, 0,
        0, 0, -h,
        c[0], c[1], -c[2]*zs, c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
    // EAST
    vertices.push(x + xs/2, z, y + h/2,
        0, zs, 0,
        0, 0, h,
        c[0], c[1], c[2]*zs, -c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
}