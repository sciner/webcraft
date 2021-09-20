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
    let c = BLOCK.calcTexture(texture, null, blockLit);

    // нижняя половина текстуры
    let c_half_bottom= [
        c[0],
        c[1] + half /2,
        c[2],
        c[3] - half,
    ];

    let ao = [0, 0, 0, 0];

    // South
    let lm = MULTIPLY.COLOR.WHITE;
    ao = [0, 0, 0, 0];
    ao = BLOCK.applyLight2AO(lightmap, ao, x, y, z - 1);
    push_plane(vertices, x, yt, z - .5, c_half_bottom, lm, ao, true, false, null, .5, null);

    // North
    lm = MULTIPLY.COLOR.WHITE;
    ao = [0, 0, 0, 0];
    ao = BLOCK.applyLight2AO(lightmap, ao, x, y, z + 1);
    push_plane(vertices, x, yt, z + .5, c_half_bottom, lm, ao, true, false, null, .5, null);

    // East
    lm = MULTIPLY.COLOR.WHITE;
    ao = [0, 0, 0, 0];
    ao = BLOCK.applyLight2AO(lightmap, ao, x + 1, y, z);
    push_plane(vertices, x + 0.5, yt, z, c_half_bottom, lm, ao, false, false, null, .5, null);

    // West
    lm = MULTIPLY.COLOR.WHITE;
    ao = [0, 0, 0, 0];
    ao = BLOCK.applyLight2AO(lightmap, ao, x - 1, y, z);
    push_plane(vertices, x - 0.5, yt, z, c_half_bottom, lm, ao, false, false, null, .5, null);

    // Up and down
    c = BLOCK.calcTexture(texture, DIRECTION.DOWN, blockLit);
    lm = MULTIPLY.COLOR.WHITE;
    let flags = 0, sideFlags = 0, upFlags = 0;

    // Up
    ao = [0, 0, 0, 0];
    ao = BLOCK.applyLight2AO(lightmap, ao, x, y + 1, z);
    vertices.push(x + 0.5, z + 0.5, yt + .5,
        1, 0, 0,
        0, 1, 0,
        ...c,
        lm.r, lm.g, lm.b,
        ...ao, flags | upFlags);

    // Down
    ao = [0, 0, 0, 0];
    ao = BLOCK.applyLight2AO(lightmap, ao, x, y - 1, z);
    vertices.push(x + 0.5, z + 0.5, yt,
        1, 0, 0,
        0, -1, 0,
        ...c,
        lm.r, lm.g, lm.b,
        ...ao, flags);

}
