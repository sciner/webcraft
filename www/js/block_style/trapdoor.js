import {DIRECTION, MULTIPLY, ROTATE, TX_CNT, Vector} from '../helpers.js';

// Люк
export default class style {

    static getRegInfo() {
        return {
            styles: ['trapdoor'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        // Texture color multiplier
        let lm = MULTIPLY.COLOR.WHITE;
        if(block.id == BLOCK.DIRT.id) {
            lm = biome.dirt_color; // MULTIPLY.COLOR.GRASS;
            sideFlags = QUAD_FLAGS.MASK_BIOME;
            upFlags = QUAD_FLAGS.MASK_BIOME;
        }

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

        // F R B L
        const cardinal_direction    = block.getCardinalDirection();
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
        let on_ceil = block.extra_data.point.y >= .5;
        let thickness = 3/16; // толщина блока
        if(block.extra_data.opened) {
            let tex_up_down = BLOCK.calcTexture(texture, DIRECTION_FORWARD);
            let tex_front  = BLOCK.calcTexture(texture, DIRECTION_UP);
            let tex_side = BLOCK.calcTexture(texture, DIRECTION_LEFT);
            let x_pos = 0;
            let z_pos = 0;
            let y_pos = 0; // нарисовать в нижней части блока
            tex_side[1] -= (thickness * 2 +  .5/16) / TX_CNT;
            tex_side[2] -= (1 - thickness) / TX_CNT;
            tex_side[3] = thickness / TX_CNT;
            let size = new Vector(1, thickness, 1);
            switch(cardinal_direction) {
                case ROTATE.S: {
                    tex_up_down[1] = tex_side[1];
                    tex_up_down[2] = 1 / TX_CNT;
                    tex_up_down[3] = thickness / TX_CNT;
                    //
                    tex_side[2] = 1 / TX_CNT;
                    tex_side[3] = thickness / TX_CNT;
                    //
                    x_pos = .5;
                    z_pos = 1 - thickness/2;
                    push_part(vertices, x + x_pos, y + y_pos, z + z_pos, size.x, size.y, size.z, tex_up_down, tex_front, tex_side, cardinal_direction, block.extra_data.opened, on_ceil);
                    break;
                }
                case ROTATE.N: {
                    tex_up_down[1] = tex_side[1];
                    tex_up_down[2] = 1 / TX_CNT;
                    tex_up_down[3] = thickness / TX_CNT;
                    //
                    tex_side[2] = 1 / TX_CNT;
                    tex_side[3] = thickness / TX_CNT;
                    //
                    x_pos = .5;
                    z_pos = thickness/2;
                    size = new Vector(1, thickness, 1);
                    push_part(vertices, x + x_pos, y + y_pos, z + z_pos, size.x, size.y, size.z, tex_up_down, tex_front, tex_side, cardinal_direction, block.extra_data.opened, on_ceil);
                    break;
                }
                case ROTATE.E: {
                    tex_up_down[1] = tex_side[1];
                    tex_up_down[2] = 1 / TX_CNT;
                    tex_up_down[3] = thickness / TX_CNT;
                    //
                    tex_side[2] = 1 / TX_CNT;
                    tex_side[3] = thickness / TX_CNT;
                    //
                    x_pos = thickness/2;
                    z_pos = .5;
                    size = new Vector(thickness, 1, 1);
                    push_part(vertices, x + x_pos, y + y_pos, z + z_pos, size.x, size.y, size.z, tex_up_down, tex_side, tex_front, cardinal_direction, block.extra_data.opened, on_ceil);
                    break;
                }
                case ROTATE.W: {
                    tex_up_down[1] = tex_side[1];
                    tex_up_down[2] = 1 / TX_CNT;
                    tex_up_down[3] = thickness / TX_CNT;
                    //
                    tex_side[2] = 1 / TX_CNT;
                    tex_side[3] = thickness / TX_CNT;
                    //
                    x_pos = 1 - thickness/2;
                    z_pos = .5;
                    size = new Vector(thickness, 1, 1);
                    push_part(vertices, x + x_pos, y + y_pos, z + z_pos, thickness, 1, 1, tex_up_down, tex_side, tex_front, cardinal_direction, block.extra_data.opened, on_ceil);
                    break;
                }
            }

        } else {
            let tex_up_down = BLOCK.calcTexture(texture, DIRECTION_UP);
            let tex_front  = BLOCK.calcTexture(texture, DIRECTION_LEFT);
            let tex_side = BLOCK.calcTexture(texture, DIRECTION_FORWARD);
            let y_pos = on_ceil ? 1 - thickness : 0; // нарисовать в верхней части блока
            tex_front[1] -= (thickness * 2 +  .5/16) / TX_CNT;
            tex_front[3] = thickness / TX_CNT;
            tex_side[1] -= (thickness * 2 +  .5/16) / TX_CNT;
            tex_side[3] = thickness / TX_CNT;
            switch(cardinal_direction) {
                case ROTATE.S: {
                    break;
                }
                case ROTATE.N: {
                    break;
                }
                case ROTATE.E: {
                    break;
                }
                case ROTATE.W: {
                    break;
                }
            }
            push_part(vertices, x + .5, y + y_pos, z + .5, 1, 1, thickness, tex_up_down, tex_front, tex_side, cardinal_direction, block.extra_data.opened, on_ceil);
        }

    }

}

//
function push_part(vertices, x, y, z, xs, zs, ys, tex_up_down, tex_front, tex_side, cardinal_direction, opened, on_ceil) {

    let lm              = MULTIPLY.COLOR.WHITE;
    let flags           = 0;
    let sideFlags       = 0;
    let upFlags         = 0;

    let top_rotate      = [xs, 0, 0, 0, zs, 0]; // Поворот верхней поверхностной текстуры
    let bottom_rotate   = [xs, 0, 0, 0, -zs, 0];
    let north_rotate    = [xs, 0, 0, 0, 0, -ys];
    let south_rotate    = [xs, 0, 0, 0, 0, ys];
    let west_rotate     = [0, -zs, 0, 0, 0, ys];
    let east_rotate     = [0, zs, 0, 0, 0, ys];

    if(opened) {
        switch(cardinal_direction) {
            // SOUTH
            case ROTATE.S: {
                if(on_ceil) {
                    top_rotate = [-xs, 0, 0, 0, -zs, 0];
                    west_rotate = [0, 0, -ys, 0, -zs, 0];
                    east_rotate = [0, 0, ys, 0, -zs, 0];
                } else {
                    bottom_rotate = [-xs, 0, 0, 0, zs, 0];
                    north_rotate = [-xs, 0, 0, 0, 0, ys];
                    south_rotate = [-xs, 0, 0, 0, 0, -ys];
                    west_rotate = [0, 0, ys, 0, zs, 0];
                    east_rotate = [0, 0, -ys, 0, zs, 0];
                }
                break;
            }
            // NORTH
            case ROTATE.N: {
                if(on_ceil) {
                    bottom_rotate = [-xs, 0, 0, 0, zs, 0];
                    west_rotate = [0, 0, ys, 0, zs, 0];
                    east_rotate = [0, 0, -ys, 0, zs, 0];
                } else {
                    top_rotate = [-xs, 0, 0, 0, -zs, 0];
                    north_rotate = [-xs, 0, 0, 0, 0, ys];
                    south_rotate = [-xs, 0, 0, 0, 0, -ys];
                    west_rotate = [0, 0,- ys, 0, -zs, 0];
                    east_rotate = [0, 0, ys, 0, -zs, 0];
                }
                break;
            }
            case ROTATE.E: {
                if(on_ceil) {
                    top_rotate = [0, -zs, 0, xs, 0, 0];
                    bottom_rotate = [0, zs, 0, xs, 0, 0];
                    north_rotate = [0, 0, -ys, -xs, 0, 0];
                    south_rotate = [0, 0, -ys, xs, 0, 0];
                    west_rotate = [0, -zs, 0, 0, 0, ys];
                } else {
                    top_rotate = [0, zs, 0, -xs, 0, 0];
                    bottom_rotate = [0, -zs, 0, -xs, 0, 0];
                    north_rotate = [0, 0, ys, xs, 0, 0];
                    south_rotate = [0, 0, ys, -xs, 0, 0];
                    west_rotate = [0, zs, 0, 0, 0, -ys];
                    east_rotate = [0, -zs, 0, 0, 0, -ys];
                }
                break;
            }
            case ROTATE.W: {
                if(on_ceil) {
                    top_rotate = [0, zs, 0, -xs, 0, 0];
                    bottom_rotate = [0, -zs, 0, -xs, 0, 0];
                    north_rotate = [0, 0, ys, xs, 0, 0];
                    south_rotate = [0, 0, ys, -xs, 0, 0];
                    west_rotate = [0, -zs, 0, 0, 0, ys];
                } else {
                    top_rotate = [0, -zs, 0, xs, 0, 0];
                    bottom_rotate = [0, zs, 0, xs, 0, 0];
                    north_rotate = [0, 0, -ys, -xs, 0, 0];
                    south_rotate = [0, 0, -ys, xs, 0, 0];
                    west_rotate = [0, zs, 0, 0, 0, -ys];
                    east_rotate = [0, -zs, 0, 0, 0, -ys];
                }
                break;
            }
        }
    } else {
        switch(cardinal_direction) {
            // SOUTH
            case ROTATE.S: {
                bottom_rotate = [-xs, 0, 0, 0, zs, 0];
                break;
            }
            // NORTH
            case ROTATE.N: {
                top_rotate = [-xs, 0, 0, 0, -zs, 0];
                break;
            }
            case ROTATE.E: {
                top_rotate = [0, zs, 0, -xs, 0, 0];
                bottom_rotate = [0, -zs, 0, -xs, 0, 0];
                break;
            }
            case ROTATE.W: {
                top_rotate = [0, -zs, 0, xs, 0, 0];
                bottom_rotate = [0, zs, 0, xs, 0, 0];
                break;
            }
        }
    }
    // TOP
    vertices.push(x, z, y + ys,
        ...top_rotate,
        tex_up_down[0], tex_up_down[1], tex_up_down[2], tex_up_down[3],
        lm.r, lm.g, lm.b, flags | upFlags);
    // BOTTOM
    vertices.push(x, z, y,
        ...bottom_rotate,
        tex_up_down[0], tex_up_down[1], tex_up_down[2], tex_up_down[3],
        lm.r, lm.g, lm.b, flags);
    // SOUTH
    vertices.push(x, z - zs/2, y + ys/2,
        ...south_rotate,
        tex_front[0], tex_front[1], tex_front[2], -tex_front[3],
        lm.r, lm.g, lm.b, flags | sideFlags);
    // NORTH
    vertices.push(x, z + zs/2, y + ys/2,
        ...north_rotate,
        tex_front[0], tex_front[1], -tex_front[2], tex_front[3],
        lm.r, lm.g, lm.b, flags | sideFlags);
    // WEST
    vertices.push(x - xs/2, z, y + ys/2,
        ...west_rotate,
        tex_side[0], tex_side[1], tex_side[2], -tex_side[3],
        lm.r, lm.g, lm.b, flags | sideFlags);
    // EAST
    vertices.push(x + xs/2, z, y + ys/2,
        ...east_rotate,
        tex_side[0], tex_side[1], tex_side[2], -tex_side[3],
        lm.r, lm.g, lm.b, flags | sideFlags);
}
