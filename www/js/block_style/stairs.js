import {DIRECTION, MULTIPLY, NORMALS, ROTATE, TX_CNT} from '../helpers.js';
import {push_plane} from './plane.js';

// Ступеньки
export function push_stairs(block, vertices, world, lightmap, x, y, z) {

    const half          = 0.5 / TX_CNT;
    let poses           = [];
    let texture         = BLOCK.fromId(block.id).texture;
    let lm              = MULTIPLY.COLOR.WHITE;
    let blockLit        = true;

    block.transparent   = true;

    // полная текстура
    let c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, null));

    // четверть текстуры
    let c_half = [
        c[0] - half/2,
        c[1] - half/2,
        c[2] - half,
        c[3] - half,
    ];
    // нижняя половина текстуры
    let c_half_bottom = [
        c[0],
        c[1] + half/2,
        c[2],
        c[3] - half,
    ];

    // стенка 1
    let n = NORMALS.FORWARD;
    push_plane(vertices, x, y, z - 0.5, c_half_bottom, lm, n, true, false, null, .5, null);

    // стенка 2
    n = NORMALS.BACK;
    push_plane(vertices, x, y, z + 0.5, c_half_bottom, lm, n, true, false, null, .5, null);

    // стенка 3
    n = NORMALS.RIGHT;
    push_plane(vertices, x + 0.5, y, z, c_half_bottom, lm, n, false, false, null, .5, null);

    // стенка 4
    n = NORMALS.LEFT;
    push_plane(vertices, x - 0.5, y, z, c_half_bottom, lm, n, false, false, null, .5, null);

    c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION.DOWN));

    // дно
    n = NORMALS.DOWN;
    vertices.push(x + .5, z + .5, y,
        1, 0, 0,
        0, -1, 0,
        c[0], c[1], c[2], -c[3],
        lm.r, lm.g, lm.b,
        lm.a, lm.a, lm.a, lm.a, 0);

    // поверхность нижней ступени
    const bH = 0.5;
    n = NORMALS.UP;
    vertices.push(x + .5, z + .5, y + bH,
        1, 0, 0,
        0, 1, 0,
        c[0], c[1], c[2], c[3],
        lm.r, lm.g, lm.b,
        lm.a, lm.a, lm.a, lm.a, 0);

    const cardinal_direction = BLOCK.getCardinalDirection(block.rotate).z;

    // F R B L
    switch(cardinal_direction) {
        case ROTATE.S: {
            poses = [
                new Vector(0, 0, .5),
                new Vector(-.5, 0, .5),
            ];
            break;
        }
        case ROTATE.W: {
            poses = [
                new Vector(0, 0, 0),
                new Vector(0, 0, .5),
            ];
            break;
        }
        case ROTATE.N: {
            poses = [
                new Vector(0, 0, 0),
                new Vector(-.5, 0, 0),
            ];
            break;
        }
        case ROTATE.E: {
            poses = [
                new Vector(-.5, 0, 0),
                new Vector(-.5, 0, .5),
            ];
            break;
        }
    }

    // Верхняя ступень
    for(let pose of poses) {

        // левая стенка
        n = NORMALS.RIGHT;
        push_plane(vertices, x + 0.5 + pose.x, y + .5, z + pose.z, c_half, lm, n, false, false, null, .5, .5);

        // передняя стенка
        n = NORMALS.FORWARD;
        push_plane(vertices, x + 0.5 + pose.x, y + 0.5, z - 0.5 + pose.z, c_half, lm, n, true, false, .5, .5, null);

        // задняя стенка
        n = NORMALS.BACK;
        push_plane(vertices, x + 0.5 + pose.x, y + 0.5, z + pose.z, c_half, lm, n, true, false, .5, .5, null);

        // правая стенка
        n = NORMALS.LEFT;
        push_plane(vertices, x + pose.x, y + 0.5, z + pose.z, c_half, lm, n, false, false, null, .5, .5);

        // поверхность
        n = NORMALS.UP;
        let bH = 1.0;
        vertices.push(x + .75 + pose.x, z + .25 + pose.z, y + bH,
            .5, 0, 0,
            0, .5, 0,
            c_half[0], c_half[1], c_half[2], c_half[3],
            lm.r, lm.g, lm.b,
            lm.a, lm.a, lm.a, lm.a, 0);
    }

}