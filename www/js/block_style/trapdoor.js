import {DIRECTION, MULTIPLY, ROTATE, TX_CNT, Vector} from '../helpers.js';

// Люк
export function push_trapdoor(block, vertices, chunk, lightmap, x, y, z, neighbours, biome) {

    if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
        return;
    }

    let flags = 0;
    let sideFlags = 0;
    let upFlags = 0;

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

    if(!block.name) {
        console.error('block', JSON.stringify(block), block.id);
        debugger;
    }

    let texture                 = BLOCK[block.name].texture;
    let blockLit                = true;

    // F R B L
    const cardinal_direction    = BLOCK.getCardinalDirection(block.rotate).z;
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
    let ao = calcAOForBlock(x, y, z);
    if(!block.extra_data) {
        block.extra_data = {
            opened: true,
            point: new Vector(0, 0, 0),
        };
    }
    let on_ceil = block.extra_data.point.y >= .5;
    let thickness = 3/16; // толщина блока
    if(block.extra_data.opened) {
        let tex_up_down = BLOCK.calcTexture(texture(chunk, lightmap, blockLit, x, y, z, DIRECTION_FORWARD));
        let tex_front  = BLOCK.calcTexture(texture(chunk, lightmap, blockLit, x, y, z, DIRECTION_UP));
        let tex_side = BLOCK.calcTexture(texture(chunk, lightmap, blockLit, x, y, z, DIRECTION_LEFT));
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
                push_part(vertices, x + x_pos, y + y_pos, z + z_pos, size.x, size.y, size.z, ao, tex_up_down, tex_front, tex_side, cardinal_direction, block.extra_data.opened, on_ceil);
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
                push_part(vertices, x + x_pos, y + y_pos, z + z_pos, size.x, size.y, size.z, ao, tex_up_down, tex_front, tex_side, cardinal_direction, block.extra_data.opened, on_ceil);
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
                push_part(vertices, x + x_pos, y + y_pos, z + z_pos, size.x, size.y, size.z, ao, tex_up_down, tex_side, tex_front, cardinal_direction, block.extra_data.opened, on_ceil);
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
                push_part(vertices, x + x_pos, y + y_pos, z + z_pos, thickness, 1, 1, ao, tex_up_down, tex_side, tex_front, cardinal_direction, block.extra_data.opened, on_ceil);
                break;
            }
        }

    } else {
        let tex_up_down = BLOCK.calcTexture(texture(chunk, lightmap, blockLit, x, y, z, DIRECTION_UP));
        let tex_front  = BLOCK.calcTexture(texture(chunk, lightmap, blockLit, x, y, z, DIRECTION_LEFT));
        let tex_side = BLOCK.calcTexture(texture(chunk, lightmap, blockLit, x, y, z, DIRECTION_FORWARD));
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
        push_part(vertices, x + .5, y + y_pos, z + .5, 1, 1, thickness, ao, tex_up_down, tex_front, tex_side, cardinal_direction, block.extra_data.opened, on_ceil);
    }

}

//
function push_part(vertices, x, y, z, xs, zs, ys, ao, tex_up_down, tex_front, tex_side, cardinal_direction, opened, on_ceil) {

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
        lm.r, lm.g, lm.b,
        ao.TOP[0], ao.TOP[1], ao.TOP[2], ao.TOP[3], flags | upFlags);
    // BOTTOM
    vertices.push(x, z, y,
        ...bottom_rotate,
        tex_up_down[0], tex_up_down[1], tex_up_down[2], tex_up_down[3],
        lm.r, lm.g, lm.b,
        ao.BOTTOM[0], ao.BOTTOM[1], ao.BOTTOM[2], ao.BOTTOM[3], flags);
    // SOUTH
    vertices.push(x, z - zs/2, y + ys/2,
        ...south_rotate,
        tex_front[0], tex_front[1], tex_front[2], -tex_front[3],
        lm.r, lm.g, lm.b,
        ao.SOUTH[0], ao.SOUTH[1], ao.SOUTH[2], ao.SOUTH[3], flags | sideFlags);
    // NORTH
    vertices.push(x, z + zs/2, y + ys/2,
        ...north_rotate,
        tex_front[0], tex_front[1], -tex_front[2], tex_front[3],
        lm.r, lm.g, lm.b,
        ao.NORTH[0], ao.NORTH[1], ao.NORTH[2], ao.NORTH[3], flags | sideFlags);
    // WEST
    vertices.push(x - xs/2, z, y + ys/2,
        ...west_rotate,
        tex_side[0], tex_side[1], tex_side[2], -tex_side[3],
        lm.r, lm.g, lm.b,
        ao.WEST[0], ao.WEST[1], ao.WEST[2], ao.WEST[3], flags | sideFlags);
    // EAST
    vertices.push(x + xs/2, z, y + ys/2,
        ...east_rotate,
        tex_side[0], tex_side[1], tex_side[2], -tex_side[3],
        lm.r, lm.g, lm.b,
        ao.EAST[0], ao.EAST[1], ao.EAST[2], ao.EAST[3], flags | sideFlags);
}

function calcAOForBlock(x, y, z) {

    // Ambient occlusion
    const ao_enabled = true;
    const ao_value = .23;

    // Result
    let result = {
        TOP:    [0, 0, 0, 0],
        BOTTOM: [.5, .5, .5, .5],
        SOUTH:  [0, 0, 0, 0],
        NORTH:  [0, 0, 0, 0],
        WEST:   [0, 0, 0, 0],
        EAST:   [0, 0, 0, 0],
    }

    // TOP
    if(ao_enabled) {
        let ao = result.TOP;
        let aa = BLOCK.getCachedBlock(chunk, x, y + 1, z - 1);
        let ab = BLOCK.getCachedBlock(chunk, x - 1, y + 1, z);
        let ac = BLOCK.getCachedBlock(chunk, x - 1, y + 1, z - 1);
        let ad = BLOCK.getCachedBlock(chunk, x, y + 1, z + 1);
        let ae = BLOCK.getCachedBlock(chunk, x + 1, y + 1, z);
        let af = BLOCK.getCachedBlock(chunk, x + 1, y + 1, z + 1);
        let ag = BLOCK.getCachedBlock(chunk, x - 1, y + 1, z + 1);
        let ah = BLOCK.getCachedBlock(chunk, x + 1, y + 1, z - 1);
        let aj = BLOCK.getCachedBlock(chunk, x, y + 1, z);
        if(BLOCK.visibleForAO(aa)) {ao[0] = ao_value; ao[1] = ao_value;}
        if(BLOCK.visibleForAO(ab)) {ao[0] = ao_value; ao[3] = ao_value;}
        if(BLOCK.visibleForAO(ac)) {ao[0] = ao_value; }
        if(BLOCK.visibleForAO(ad)) {ao[2] = ao_value; ao[3] = ao_value; }
        if(BLOCK.visibleForAO(ae)) {ao[1] = ao_value; ao[2] = ao_value; }
        if(BLOCK.visibleForAO(af)) {ao[2] = ao_value;}
        if(BLOCK.visibleForAO(ag)) {ao[3] = ao_value;}
        if(BLOCK.visibleForAO(ah)) {ao[1] = ao_value;}
        if(BLOCK.visibleForAO(aj)) {ao[0] = ao_value; ao[1] = ao_value; ao[2] = ao_value; ao[1] = ao_value;}
    }

    // SOUTH
    if(ao_enabled) {
        let ao = result.SOUTH;
        // ao[0] - левый нижний
        // ao[1] - правый нижний
        // ao[2] - правый верхний
        // ao[3] - левый верхний
        let aa = BLOCK.getCachedBlock(chunk, x - 1, y, z - 1);
        let ab = BLOCK.getCachedBlock(chunk, x + 1, y, z - 1);
        let ac = BLOCK.getCachedBlock(chunk, x, y - 1, z - 1);
        let ad = BLOCK.getCachedBlock(chunk, x + 1, y - 1, z - 1);
        let ae = BLOCK.getCachedBlock(chunk, x, y + 1, z - 1);
        let af = BLOCK.getCachedBlock(chunk, x + 1, y + 1, z - 1);
        let ag = BLOCK.getCachedBlock(chunk, x - 1, y - 1, z - 1);
        let ah = BLOCK.getCachedBlock(chunk, x - 1, y + 1, z - 1);
        let aj = BLOCK.getCachedBlock(chunk, x, y, z - 1); // to South
        if(BLOCK.visibleForAO(aa)) {ao[0] = ao_value; ao[3] = ao_value;}
        if(BLOCK.visibleForAO(ab)) {ao[1] = ao_value; ao[2] = ao_value;}
        if(BLOCK.visibleForAO(ac)) {ao[0] = ao_value; ao[1] = ao_value;}
        if(BLOCK.visibleForAO(ad)) {ao[1] = ao_value;}
        if(BLOCK.visibleForAO(ae)) {ao[2] = ao_value; ao[3] = ao_value;}
        if(BLOCK.visibleForAO(af)) {ao[2] = ao_value;}
        if(BLOCK.visibleForAO(ag)) {ao[0] = ao_value;}
        if(BLOCK.visibleForAO(ah)) {ao[3] = ao_value;}
        if(BLOCK.visibleForAO(aj)) {ao[0] = ao_value; ao[1] = ao_value; ao[2] = ao_value; ao[3] = ao_value;}
    }

    // NORTH
    if(ao_enabled) {
        let ao = result.NORTH;
        // ao[0] - правый верхний
        // ao[1] - левый верхний
        // ao[2] - левый нижний
        // ao[3] - правый нижний
        let aa = BLOCK.getCachedBlock(chunk, x + 1, y - 1, z + 1);
        let ab = BLOCK.getCachedBlock(chunk, x, y - 1, z + 1);
        let ac = BLOCK.getCachedBlock(chunk, x + 1, y, z + 1);
        let ad = BLOCK.getCachedBlock(chunk, x - 1, y, z + 1);
        let ae = BLOCK.getCachedBlock(chunk, x - 1, y - 1, z + 1);
        let af = BLOCK.getCachedBlock(chunk, x, y + 1, z + 1);
        let ag = BLOCK.getCachedBlock(chunk, x - 1, y + 1, z + 1);
        let ah = BLOCK.getCachedBlock(chunk, x + 1, y + 1, z + 1);
        let aj = BLOCK.getCachedBlock(chunk, x, y, z + 1); // to North
        if(BLOCK.visibleForAO(aa)) {ao[2] = ao_value;}
        if(BLOCK.visibleForAO(ab)) {ao[2] = ao_value; ao[3] = ao_value;}
        if(BLOCK.visibleForAO(ac)) {ao[1] = ao_value; ao[2] = ao_value;}
        if(BLOCK.visibleForAO(ad)) {ao[0] = ao_value; ao[3] = ao_value;}
        if(BLOCK.visibleForAO(ae)) {ao[3] = ao_value;}
        if(BLOCK.visibleForAO(af)) {ao[0] = ao_value; ao[1] = ao_value;}
        if(BLOCK.visibleForAO(ag)) {ao[0] = ao_value;}
        if(BLOCK.visibleForAO(ah)) {ao[1] = ao_value;}
        if(BLOCK.visibleForAO(aj)) {ao[0] = ao_value; ao[1] = ao_value; ao[2] = ao_value; ao[3] = ao_value;}
    }

    // WEST
    if(ao_enabled) {
        let ao = result.WEST;
        // ao[0] - правый верхний
        // ao[1] - левый верхний
        // ao[2] - левый нижний
        // ao[3] - правый нижний
        let aa = BLOCK.getCachedBlock(chunk, x - 1, y - 1, z - 1);
        let ab = BLOCK.getCachedBlock(chunk, x - 1, y - 1, z);
        let ac = BLOCK.getCachedBlock(chunk, x - 1, y - 1, z + 1);
        let ad = BLOCK.getCachedBlock(chunk, x - 1, y, z - 1);
        let ae = BLOCK.getCachedBlock(chunk, x - 1, y, z + 1);
        let af = BLOCK.getCachedBlock(chunk, x - 1, y + 1, z - 1);
        let ag = BLOCK.getCachedBlock(chunk, x - 1, y + 1, z);
        let ah = BLOCK.getCachedBlock(chunk, x - 1, y + 1, z + 1);
        let aj = BLOCK.getCachedBlock(chunk, x - 1, y, z); // to West
        if(BLOCK.visibleForAO(aa)) {ao[3] = ao_value;}
        if(BLOCK.visibleForAO(ab)) {ao[2] = ao_value; ao[3] = ao_value;}
        if(BLOCK.visibleForAO(ac)) {ao[2] = ao_value;}
        if(BLOCK.visibleForAO(ad)) {ao[0] = ao_value; ao[3] = ao_value;}
        if(BLOCK.visibleForAO(ae)) {ao[1] = ao_value; ao[2] = ao_value;}
        if(BLOCK.visibleForAO(af)) {ao[0] = ao_value;}
        if(BLOCK.visibleForAO(ag)) {ao[0] = ao_value; ao[1] = ao_value;}
        if(BLOCK.visibleForAO(ah)) {ao[1] = ao_value;}
        if(BLOCK.visibleForAO(aj)) {ao[0] = ao_value; ao[1] = ao_value; ao[2] = ao_value; ao[3] = ao_value;}
    }

    // EAST
    if(ao_enabled) {
        let ao = result.EAST;
        // ao[0] - левый нижний
        // ao[1] - правый нижний
        // ao[2] - правый верхний
        // ao[3] - левый верхний
        let aa = BLOCK.getCachedBlock(chunk, x + 1, y, z - 1);
        let ab = BLOCK.getCachedBlock(chunk, x + 1, y, z + 1);
        let ac = BLOCK.getCachedBlock(chunk, x + 1, y - 1, z);
        let ad = BLOCK.getCachedBlock(chunk, x + 1, y - 1, z + 1);
        let ae = BLOCK.getCachedBlock(chunk, x + 1, y + 1, z + 1);
        let af = BLOCK.getCachedBlock(chunk, x + 1, y - 1, z - 1);
        let ag = BLOCK.getCachedBlock(chunk, x + 1, y + 1, z);
        let ah = BLOCK.getCachedBlock(chunk, x + 1, y + 1, z - 1);
        let aj = BLOCK.getCachedBlock(chunk, x + 1, y, z); // to East
        if(BLOCK.visibleForAO(aa)) {ao[0] = ao_value; ao[3] = ao_value;}
        if(BLOCK.visibleForAO(ab)) {ao[1] = ao_value; ao[2] = ao_value;}
        if(BLOCK.visibleForAO(ac)) {ao[0] = ao_value; ao[1] = ao_value;}
        if(BLOCK.visibleForAO(ad)) {ao[1] = ao_value;}
        if(BLOCK.visibleForAO(ae)) {ao[2] = ao_value;}
        if(BLOCK.visibleForAO(af)) {ao[0] = ao_value;}
        if(BLOCK.visibleForAO(ag)) {ao[2] = ao_value; ao[3] = ao_value;}
        if(BLOCK.visibleForAO(ah)) {ao[3] = ao_value;}
        if(BLOCK.visibleForAO(aj)) {ao[0] = ao_value; ao[1] = ao_value; ao[2] = ao_value; ao[3] = ao_value;}
    }

    return result;

}
