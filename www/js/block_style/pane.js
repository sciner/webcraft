import {DIRECTION, MULTIPLY, NORMALS, ROTATE} from '../helpers.js';
import {BLOCK} from "../blocks.js";

// Панель
export default class style {

    static getRegInfo() {
        return {
            styles: ['pane'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        const cardinal_direction = block.getCardinalDirection();

        // Texture color multiplier
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

        let texture         = block.material.texture;
        let w               = 2/16;
        let h               = 0.9998;
        let bottom          = y + 1 - h;
        let connect_u       = 7/16;
        let connect_v       = 2/16;
        let tex             = BLOCK.calcTexture(texture, DIRECTION_FORWARD);

        let con_s = BLOCK.canPaneConnect(neighbours.SOUTH);
        let con_n = BLOCK.canPaneConnect(neighbours.NORTH);
        let con_w = BLOCK.canPaneConnect(neighbours.WEST);
        let con_e = BLOCK.canPaneConnect(neighbours.EAST);

        let no_draw_center_sides = [];
        if(con_s) no_draw_center_sides.push(ROTATE.S);
        if(con_n) no_draw_center_sides.push(ROTATE.N);
        if(con_w) no_draw_center_sides.push(ROTATE.W);
        if(con_e) no_draw_center_sides.push(ROTATE.E);

        push_part(vertices, tex, x + .5, bottom, z + .5, w, w, 1, no_draw_center_sides);

        // South
        if(con_s) {
            push_part(vertices, tex, x + .5, bottom, z + connect_u/2, connect_v, connect_u, h, [ROTATE.N, ROTATE.S]);
        }
        // North
        if(con_n) {
            push_part(vertices, tex, x + .5, bottom, z + 1 - connect_u/2, connect_v, connect_u, h, [ROTATE.N, ROTATE.S]);
        }
        // West
        if(con_w) {
            push_part(vertices, tex, x + connect_u/2, bottom, z + .5, connect_u, connect_v, h, [ROTATE.E, ROTATE.W]);
        }
        // East
        if(con_e) {
            push_part(vertices, tex, x + 1 - connect_u/2, bottom, z + .5, connect_u, connect_v, h, [ROTATE.E, ROTATE.W]);
        }

    }

}

function push_part(vertices, c, x, y, z, xs, zs, h, no_draw_center_sides) {
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
    if(!no_draw_center_sides || no_draw_center_sides.indexOf(ROTATE.S) < 0) {
        vertices.push(x, z - zs/2, y + h/2,
            xs, 0, 0,
            0, 0, h,
            c[0], c[1], c[2]*xs, -c[3]*h,
            lm.r, lm.g, lm.b, flags | sideFlags);
    }
    // NORTH
    if(!no_draw_center_sides || no_draw_center_sides.indexOf(ROTATE.N) < 0) {
        vertices.push(x, z + zs/2, y + h/2,
            xs, 0, 0,
            0, 0, -h,
            c[0], c[1], -c[2]*xs, c[3]*h,
            lm.r, lm.g, lm.b, flags | sideFlags);
    }
    // WEST
    if(!no_draw_center_sides || no_draw_center_sides.indexOf(ROTATE.W) < 0) {
        vertices.push(x - xs/2, z, y + h/2,
            0, zs, 0,
            0, 0, -h,
            c[0], c[1], -c[2]*zs, c[3]*h,
            lm.r, lm.g, lm.b, flags | sideFlags);
    }
    // EAST
    if(!no_draw_center_sides || no_draw_center_sides.indexOf(ROTATE.E) < 0) {
        vertices.push(x + xs/2, z, y + h/2,
            0, zs, 0,
            0, 0, h,
            c[0], c[1], c[2]*zs, -c[3]*h,
            lm.r, lm.g, lm.b, flags | sideFlags);
    }
}