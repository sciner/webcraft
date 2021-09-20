import {DIRECTION, MULTIPLY, NORMALS, ROTATE} from '../helpers.js';

// Панель
export function push_pane(block, vertices, chunk, lightmap, x, y, z, neighbours) {

    if(typeof block == 'undefined') {
        return;
    }

    const cardinal_direction = BLOCK.getCardinalDirection(block.rotate).z;

    let texture     = BLOCK[block.name].texture;
    let blockLit    = true;
    let bH          = 1.0;
    let lm          = MULTIPLY.COLOR.WHITE;
    let ao          = [0, 0, 0, 0];
    let c           = BLOCK.calcTexture(texture, DIRECTION.FORWARD, blockLit);

    ao = BLOCK.applyLight2AO(lightmap, ao, x, y, z);

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
                ...ao, 0);
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
                ...ao, 0);
            break;
        }
    }

}
