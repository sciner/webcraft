import {DIRECTION, MULTIPLY, ROTATE, Vector} from '../helpers.js';

// Забор
export function push_fence(block, vertices, world, lightmap, x, y, z, neighbours, biome) {

    if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
        return;
    }

    const cardinal_direction    = BLOCK.getCardinalDirection(block.rotate).z;
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
    
    let tex = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_FORWARD));
    let ao = calcAOForBlock(x, y, z);
    push_part(vertices, tex, x + .5, y, z + .5, 4/16, 4/16, 1, ao);

    //
    let canConnect = (block) => {
        return block && (!block.transparent || block.style == 'fence');
    };

    // South
    if(canConnect(neighbours.SOUTH)) {
        push_part(vertices, tex, x + .5, y + 6/16, z + .5 - 5/16, 2/16, 6/16, 2/16, ao);
        push_part(vertices, tex, x + .5, y + 12/16, z + .5 - 5/16, 2/16, 6/16, 2/16, ao);
    }
    // North
    if(canConnect(neighbours.NORTH)) {
        push_part(vertices, tex, x + .5, y + 6/16, z + .5 + 5/16, 2/16, 6/16, 2/16, ao);
        push_part(vertices, tex, x + .5, y + 12/16, z + .5 + 5/16, 2/16, 6/16, 2/16, ao);
    }
    // West
    if(canConnect(neighbours.WEST)) {
        push_part(vertices, tex, x + .5 - 5/16, y + 6/16, z + .5, 6/16, 2/16, 2/16, ao);
        push_part(vertices, tex, x + .5 - 5/16, y + 12/16, z + .5, 6/16, 2/16, 2/16, ao);
    }
    // East
    if(canConnect(neighbours.EAST)) {
        push_part(vertices, tex, x + .5 + 5/16, y + 6/16, z + .5, 6/16, 2/16, 2/16, ao);
        push_part(vertices, tex, x + .5 + 5/16, y + 12/16, z + .5, 6/16, 2/16, 2/16, ao);
    }

}

function push_part(vertices, c, x, y, z, xs, zs, h, ao) {
    let lm          = MULTIPLY.COLOR.WHITE;
    let flags       = 0;
    let sideFlags   = 0;
    let upFlags     = 0;
    // TOP
    vertices.push(x, z, y + h,
        xs, 0, 0,
        0, zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        lm.r, lm.g, lm.b,
        ao.TOP[0], ao.TOP[1], ao.TOP[2], ao.TOP[3], flags | upFlags);
    // BOTTOM
    vertices.push(x, z, y, 
        xs, 0, 0,
        0, -zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        lm.r, lm.g, lm.b,
        ao.BOTTOM[0], ao.BOTTOM[1], ao.BOTTOM[2], ao.BOTTOM[3], flags);
    // SOUTH
    vertices.push(x, z - zs/2, y + h/2,
        xs, 0, 0,
        0, 0, h,
        c[0], c[1], c[2]*xs, -c[3]*h,
        lm.r, lm.g, lm.b,
        ao.SOUTH[0], ao.SOUTH[1], ao.SOUTH[2], ao.SOUTH[3], flags | sideFlags);
    // NORTH
    vertices.push(x, z + zs/2, y + h/2,
        xs, 0, 0,
        0, 0, -h,
        c[0], c[1], -c[2]*xs, c[3]*h,
        lm.r, lm.g, lm.b,
        ao.NORTH[0], ao.NORTH[1], ao.NORTH[2], ao.NORTH[3], flags | sideFlags);
    // WEST
    vertices.push(x - xs/2, z, y + h/2,
        0, zs, 0,
        0, 0, -h,
        c[0], c[1], -c[2]*zs, c[3]*h,
        lm.r, lm.g, lm.b,
        ao.WEST[0], ao.WEST[1], ao.WEST[2], ao.WEST[3], flags | sideFlags);
    // EAST
    vertices.push(x + xs/2, z, y + h/2,
        0, zs, 0,
        0, 0, h,
        c[0], c[1], c[2]*zs, -c[3]*h,
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
        let aa = BLOCK.getCachedBlock(x, y + 1, z - 1);
        let ab = BLOCK.getCachedBlock(x - 1, y + 1, z);
        let ac = BLOCK.getCachedBlock(x - 1, y + 1, z - 1);
        let ad = BLOCK.getCachedBlock(x, y + 1, z + 1);
        let ae = BLOCK.getCachedBlock(x + 1, y + 1, z);
        let af = BLOCK.getCachedBlock(x + 1, y + 1, z + 1);
        let ag = BLOCK.getCachedBlock(x - 1, y + 1, z + 1);
        let ah = BLOCK.getCachedBlock(x + 1, y + 1, z - 1);
        let aj = BLOCK.getCachedBlock(x, y + 1, z);
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
        let aa = BLOCK.getCachedBlock(x - 1, y, z - 1);
        let ab = BLOCK.getCachedBlock(x + 1, y, z - 1);
        let ac = BLOCK.getCachedBlock(x, y - 1, z - 1);
        let ad = BLOCK.getCachedBlock(x + 1, y - 1, z - 1);
        let ae = BLOCK.getCachedBlock(x, y + 1, z - 1);
        let af = BLOCK.getCachedBlock(x + 1, y + 1, z - 1);
        let ag = BLOCK.getCachedBlock(x - 1, y - 1, z - 1);
        let ah = BLOCK.getCachedBlock(x - 1, y + 1, z - 1);
        let aj = BLOCK.getCachedBlock(x, y, z - 1); // to South
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
        let aa = BLOCK.getCachedBlock(x + 1, y - 1, z + 1);
        let ab = BLOCK.getCachedBlock(x, y - 1, z + 1);
        let ac = BLOCK.getCachedBlock(x + 1, y, z + 1);
        let ad = BLOCK.getCachedBlock(x - 1, y, z + 1);
        let ae = BLOCK.getCachedBlock(x - 1, y - 1, z + 1);
        let af = BLOCK.getCachedBlock(x, y + 1, z + 1);
        let ag = BLOCK.getCachedBlock(x - 1, y + 1, z + 1);
        let ah = BLOCK.getCachedBlock(x + 1, y + 1, z + 1);
        let aj = BLOCK.getCachedBlock(x, y, z + 1); // to North
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
        let aa = BLOCK.getCachedBlock(x - 1, y - 1, z - 1);
        let ab = BLOCK.getCachedBlock(x - 1, y - 1, z);
        let ac = BLOCK.getCachedBlock(x - 1, y - 1, z + 1);
        let ad = BLOCK.getCachedBlock(x - 1, y, z - 1);
        let ae = BLOCK.getCachedBlock(x - 1, y, z + 1);
        let af = BLOCK.getCachedBlock(x - 1, y + 1, z - 1);
        let ag = BLOCK.getCachedBlock(x - 1, y + 1, z);
        let ah = BLOCK.getCachedBlock(x - 1, y + 1, z + 1);
        let aj = BLOCK.getCachedBlock(x - 1, y, z); // to West
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
        let aa = BLOCK.getCachedBlock(x + 1, y, z - 1);
        let ab = BLOCK.getCachedBlock(x + 1, y, z + 1);
        let ac = BLOCK.getCachedBlock(x + 1, y - 1, z);
        let ad = BLOCK.getCachedBlock(x + 1, y - 1, z + 1);
        let ae = BLOCK.getCachedBlock(x + 1, y + 1, z + 1);
        let af = BLOCK.getCachedBlock(x + 1, y - 1, z - 1);
        let ag = BLOCK.getCachedBlock(x + 1, y + 1, z);
        let ah = BLOCK.getCachedBlock(x + 1, y + 1, z - 1);
        let aj = BLOCK.getCachedBlock(x + 1, y, z); // to East
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