import {DIRECTION, MULTIPLY, NORMALS, ROTATE} from '../helpers.js';

// Панель
export function push_pane(block, vertices, world, lightmap, x, y, z, neighbours) {

    if(typeof block == 'undefined') {
        return;
    }

    const cardinal_direction = BLOCK.getCardinalDirection(block.rotate).z;

    let texture     = BLOCK[block.name].texture;
    let blockLit    = true;
    let bH          = 1.0;
    let lm          = MULTIPLY.COLOR.WHITE;
    let c           = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION.FORWARD));

    switch(cardinal_direction) {
        case ROTATE.N:
        case ROTATE.S: {
            // Front
            let n = NORMALS.FORWARD;
            vertices.push(x + .5, z + .5, y + bH/2,
                1, 0, 0,
                0, 0, bH,
                c[0], c[1], c[2], -c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);
            /*n = NORMALS.BACK;
            vertices.push(x + .5, z + .5, y + bH/2,
                1, 0, 0,
                0, 0, -bH,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);*/
            break;
        }
        case ROTATE.E:
        case ROTATE.W: {
            // Left
            let n = NORMALS.LEFT;
            vertices.push(x + .5, z + .5, y + bH/2,
                0, 1, 0,
                0, 0, -bH,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);
            // Right
            /*n = NORMALS.RIGHT;
            vertices.push(x + .5, z + .5, y + bH/2,
                0, 1, 0,
                0, 0, bH,
                c[0], c[1], c[2], -c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);*/
            break;
        }
    }

}