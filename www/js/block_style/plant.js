import {MULTIPLY, DIRECTION, QUAD_FLAGS} from '../helpers.js';
import {push_plane} from './plane.js';

// Растения
export function push_plant(block, vertices, chunk, lightmap, x, y, z, biome) {
    let texture     = BLOCK.fromId(block.id).texture;
    let c = BLOCK.calcTexture(texture, DIRECTION.UP);
    let lm = MULTIPLY.COLOR.WHITE;
    let flags = QUAD_FLAGS.NORMAL_UP;
    // Texture color multiplier
    if(block.id == BLOCK.GRASS.id) {
        lm = biome.dirt_color;
        flags |= QUAD_FLAGS.MASK_BIOME;
    }
    let ao = [0, 0, 0, 0];
    if(block.id == BLOCK.GRASS.id) {
        y -= .15;
    }
    if(chunk.coord) {
        ao = BLOCK.applyLight2AO(lightmap, ao, x, Math.round(y), z);
    }
    push_plane(vertices, x, y, z, c, lm, ao, true, true, undefined, undefined, undefined, flags);
}
