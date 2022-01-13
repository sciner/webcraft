import {DIRECTION, MULTIPLY, ROTATE, TX_CNT, Vector} from '../helpers.js';
import {CubeSym, pushSym} from '../core/CubeSym.js';
import {BLOCK} from "../blocks.js";

const Z_FIGHT_ERROR = 0.001;

// Дверь
export default class style {

    static getRegInfo() {
        return {
            styles: ['door'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        const thickness             = 3/16; // толщина блока

        let DIRECTION_UP            = DIRECTION.UP;
        let DIRECTION_DOWN          = DIRECTION.DOWN;
        let DIRECTION_BACK          = DIRECTION.BACK;
        let DIRECTION_RIGHT         = DIRECTION.RIGHT;
        let DIRECTION_FORWARD       = DIRECTION.FORWARD;
        let DIRECTION_LEFT          = DIRECTION.LEFT;

        if(!block.material.name) {
            console.error('block', JSON.stringify(block), block.id);
            debugger;
        }

        let texture                 = block.material.texture;
        let opened                  = block.extra_data.opened;

        // F R B L
        let cardinal_direction      = CubeSym.dirAdd(block.getCardinalDirection(), CubeSym.ROT_Y2);

        if(opened) {
            cardinal_direction = CubeSym.dirAdd(cardinal_direction, block.extra_data.left ? DIRECTION.RIGHT : DIRECTION.LEFT);
        }

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

        if(!block.extra_data) {
            block.extra_data = {
                opened: true,
                point: new Vector(0, 0, 0),
            };
        }

        let tex_up_down = BLOCK.calcTexture(texture, DIRECTION_FORWARD);
        let tex_front  = BLOCK.calcTexture(texture, DIRECTION_UP);
        let tex_side = BLOCK.calcTexture(texture, DIRECTION_LEFT);
        let x_pos = 0;
        let z_pos = 0;
        let y_pos = 0; // нарисовать в нижней части блока

        tex_side[0] -= (thickness * 2 +  .5/16) / TX_CNT;
        tex_side[2] = -thickness / TX_CNT;
        tex_up_down[1] -= (thickness * 2 +  .5/16) / TX_CNT;
        tex_up_down[3] = thickness / TX_CNT;

        x_pos = .5;
        z_pos = thickness/2;

        push_part(vertices, cardinal_direction,
            x + .5, y + .5, z + .5,
            x_pos - .5, y_pos - .5, z_pos - .5,
            1, thickness * (1 - Z_FIGHT_ERROR), 1,
            tex_up_down, tex_front, tex_side, block.extra_data.opened, block.extra_data.left);

    }
}

//
function push_part(vertices, cardinal_direction, cx, cy, cz, x, y, z, xs, zs, ys, tex_up_down, tex_front, tex_side, opened, left) {

    let lm              = MULTIPLY.COLOR.WHITE; // Texture color multiplier
    let flags           = 0;
    let sideFlags       = 0;
    let upFlags         = 0;

    let top_rotate      = [xs, 0, 0, 0, zs, 0]; // Поворот верхней поверхностной текстуры
    let bottom_rotate   = [xs, 0, 0, 0, -zs, 0];
    let north_rotate    = [xs, 0, 0, 0, 0, -ys];
    let south_rotate    = [xs, 0, 0, 0, 0, ys];
    let west_rotate     = [0, -zs, 0, 0, 0, ys];
    let east_rotate     = [0, zs, 0, 0, 0, ys];

    // opened door flips texture
    // flip it back
    const orient = (left ^ opened) ? 1 : -1;

    // TOP
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x, z, y + ys,
        ...top_rotate,
        tex_up_down[0], tex_up_down[1], orient * tex_up_down[2], tex_up_down[3],
        lm.r, lm.g, lm.b, flags | upFlags);
    // BOTTOM
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x, z, y + Z_FIGHT_ERROR,
        ...bottom_rotate,
        tex_up_down[0], tex_up_down[1], orient * tex_up_down[2], tex_up_down[3],
        lm.r, lm.g, lm.b, flags);
    // SOUTH
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x, z - zs/2, y + ys/2,
        ...south_rotate,
        tex_front[0], tex_front[1], orient * tex_front[2], -tex_front[3],
        lm.r, lm.g, lm.b, flags | sideFlags);
    // NORTH
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x, z + zs/2, y + ys/2,
        ...north_rotate,
        tex_front[0], tex_front[1], orient * tex_front[2], tex_front[3],
        lm.r, lm.g, lm.b, flags | sideFlags);
    // WEST
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x - xs/2 * (1 - Z_FIGHT_ERROR), z, y + ys/2,
        ...west_rotate,
        tex_side[0], tex_side[1], orient * tex_side[2], -tex_side[3],
        lm.r, lm.g, lm.b, flags | sideFlags);
    // EAST
    pushSym(vertices, cardinal_direction,
        cx, cz, cy,
        x + xs/2 * (1 - Z_FIGHT_ERROR), z, y + ys/2,
        ...east_rotate,
        tex_side[0], tex_side[1], orient * tex_side[2], -tex_side[3],
        lm.r, lm.g, lm.b, flags | sideFlags);

}