import {DIRECTION, MULTIPLY, NORMALS, TX_CNT} from '../helpers.js';
import {push_plane} from './plane.js';

// Плита
export function push_slab(block, vertices, chunk, lightmap, x, y, z) {

    const half = 0.5 / TX_CNT;

    let texture = BLOCK.fromId(block.id).texture;
	let blockLit = true;
    block.transparent = true;

    let on_ceil = block.extra_data && block.extra_data.point.y >= .5; // на верхней части блока (перевернутая ступенька)

    let yt = y;
    if(on_ceil) {
        yt += .5;
    }

    // полная текстура
    let c = BLOCK.calcTexture(texture(chunk, lightmap, blockLit, x, y, z, null));

    // нижняя половина текстуры
    let c_half_bottom= [
        c[0],
        c[1] + half /2,
        c[2],
        c[3] - half,
    ];

    // South | Front/Forward
    let lm = MULTIPLY.COLOR.WHITE;
    let n = NORMALS.FORWARD;
    push_plane(vertices, x, yt, z - .5, c_half_bottom, lm, n, true, false, null, .5, null);

    // North | Back
    lm = MULTIPLY.COLOR.WHITE;
    n = NORMALS.BACK;
    push_plane(vertices, x, yt, z + .5, c_half_bottom, lm, n, true, false, null, .5, null);

    // правая стенка
    lm = MULTIPLY.COLOR.WHITE;
    n = NORMALS.RIGHT;
    push_plane(vertices, x + 0.5, yt, z, c_half_bottom, lm, n, false, false, null, .5, null);

    // левая стенка
    lm = MULTIPLY.COLOR.WHITE;
    n = NORMALS.LEFT;
    push_plane(vertices, x - 0.5, yt, z, c_half_bottom, lm, n, false, false, null, .5, null);

    // Up and down
    c = BLOCK.calcTexture(texture(chunk, lightmap, blockLit, x, y, z, DIRECTION.DOWN));
    lm = MULTIPLY.COLOR.WHITE;
    n = NORMALS.DOWN;
    let ao = [0, 0, 0, 0];
    let flags = 0, sideFlags = 0, upFlags = 0;

    // Up
    vertices.push(x + 0.5, z + 0.5, yt + .5,
        1, 0, 0,
        0, 1, 0,
        c[0], c[1], c[2], c[3],
        lm.r, lm.g, lm.b,
        ao[0], ao[1], ao[2], ao[3], flags | upFlags);

    // Down
    //c = BLOCK.calcTexture(texture(chunk, lightmap, blockLit, x, y, z, DIRECTION_DOWN));
    vertices.push(x + 0.5, z + 0.5, yt,
        1, 0, 0,
        0, -1, 0,
        c[0], c[1], c[2], c[3],
        lm.r, lm.g, lm.b,
        ao[0], ao[1], ao[2], ao[3], flags);

}
