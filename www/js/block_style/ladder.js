import {MULTIPLY} from '../helpers.js';

// Лестница
export function push_ladder(block, vertices, chunk, lightmap, x, y, z) {

    if(typeof block == 'undefined') {
        return;
    }

    const cardinal_direction = BLOCK.getCardinalDirection(block.rotate).z;

    let texture     = BLOCK[block.name].texture;
    let blockLit    = true; // z >= lightmap[x][y];
    let bH          = 1.0;
    let width       = block.width ? block.width : 1;
    let lm          = MULTIPLY.COLOR.WHITE;
    let c           = BLOCK.calcTexture(texture(chunk, lightmap, blockLit, x, y, z, DIRECTION.FORWARD));

    switch(cardinal_direction) {
        case ROTATE.S: {
            // Front / NORMALS.FORWARD;
            vertices.push(x + .5, z + 1 - width, y + bH / 2,
                1, 0, 0,
                0, 0, bH,
                c[0], c[1], c[2], -c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);
            break;
        }
        case ROTATE.W: {
            // Left / NORMALS.LEFT;
            vertices.push(x + 1 - width, z + .5, y + bH / 2,
                0, 1, 0,
                0, 0, -bH,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);
            break;
        }
        case ROTATE.N: {
            // Back / NORMALS.BACK;
            vertices.push(x + .5, z + width, y + bH / 2,
                1, 0, 0,
                0, 0, -bH,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);
            break;
        }
        case ROTATE.E: {
            // Right / NORMALS.RIGHT;
            vertices.push(x + width, z + .5, y + bH / 2,
                0, 1, 0,
                0, 0, bH,
                c[0], c[1], c[2], -c[3],
                lm.r, lm.g, lm.b,
                lm.a, lm.a, lm.a, lm.a, 0);
            break;
        }
    }

}
