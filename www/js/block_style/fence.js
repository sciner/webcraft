import {DIRECTION, MULTIPLY, ROTATE} from '../helpers.js';
import {BLOCK, NEIGHB_BY_SYM} from "../blocks.js";

// Забор
export default class style {

    static getRegInfo() {
        return {
            styles: ['fence'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        const cardinal_direction = block.getCardinalDirection();

        // Texture color multiplier
        let lm = MULTIPLY.COLOR.WHITE;
        if(block.id == BLOCK.DIRT.id) {
            lm = biome.dirt_color; // MULTIPLY.COLOR.GRASS;
        }

        let DIRECTION_BACK          = DIRECTION.BACK;
        let DIRECTION_RIGHT         = DIRECTION.RIGHT;
        let DIRECTION_FORWARD       = DIRECTION.FORWARD;
        let DIRECTION_LEFT          = DIRECTION.LEFT;

        if(!block.material.name) {
            console.error('block', JSON.stringify(block), block.id);
            debugger;
        }

        let texture                 = block.material.texture;

        // F R B L
        switch(cardinal_direction) {
            case ROTATE.S: {
                break;
            }
            case ROTATE.W: {
                DIRECTION_BACK      = DIRECTION.LEFT;
                DIRECTION_RIGHT     = DIRECTION.BACK;
                DIRECTION_FORWARD   = DIRECTION.RIGHT;
                DIRECTION_LEFT      = DIRECTION.FORWARD;
                break;
            }
            case ROTATE.N: {
                DIRECTION_BACK      = DIRECTION.FORWARD;
                DIRECTION_RIGHT     = DIRECTION.LEFT;
                DIRECTION_FORWARD   = DIRECTION.BACK;
                DIRECTION_LEFT      = DIRECTION.RIGHT;
                break;
            }
            case ROTATE.E: {
                DIRECTION_BACK      = DIRECTION.RIGHT;
                DIRECTION_RIGHT     = DIRECTION.FORWARD;
                DIRECTION_FORWARD   = DIRECTION.LEFT;
                DIRECTION_LEFT      = DIRECTION.BACK;
                break;
            }
        }

        let tex = BLOCK.calcTexture(texture, DIRECTION_FORWARD);
        push_part(vertices, tex, x + .5, y, z + .5, 4/16, 4/16, 1);

        // South
        if(BLOCK.canFenceConnect(neighbours.SOUTH)) {
            push_part(vertices, tex, x + .5, y + 6/16, z + .5 - 5/16, 2/16, 6/16, 2/16,);
            push_part(vertices, tex, x + .5, y + 12/16, z + .5 - 5/16, 2/16, 6/16, 2/16);
        }
        // North
        if(BLOCK.canFenceConnect(neighbours.NORTH)) {
            push_part(vertices, tex, x + .5, y + 6/16, z + .5 + 5/16, 2/16, 6/16, 2/16);
            push_part(vertices, tex, x + .5, y + 12/16, z + .5 + 5/16, 2/16, 6/16, 2/16);
        }
        // West
        if(BLOCK.canFenceConnect(neighbours.WEST)) {
            push_part(vertices, tex, x + .5 - 5/16, y + 6/16, z + .5, 6/16, 2/16, 2/16);
            push_part(vertices, tex, x + .5 - 5/16, y + 12/16, z + .5, 6/16, 2/16, 2/16);
        }
        // East
        if(BLOCK.canFenceConnect(neighbours.EAST)) {
            push_part(vertices, tex, x + .5 + 5/16, y + 6/16, z + .5, 6/16, 2/16, 2/16);
            push_part(vertices, tex, x + .5 + 5/16, y + 12/16, z + .5, 6/16, 2/16, 2/16);
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