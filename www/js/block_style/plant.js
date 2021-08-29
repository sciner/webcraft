import {MULTIPLY, NORMALS, QUAD_FLAGS} from '../helpers.js';
import {push_plane} from './plane.js';

// Растения
export function push_plant(block, vertices, world, lightmap, x, y, z, biome) {
    let texture     = BLOCK.fromId(block.id).texture;
    let blockLit    = true;
    let c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, null));
    let lm = MULTIPLY.COLOR.WHITE;
    let flags = QUAD_FLAGS.NORMAL_UP;
    // Texture color multiplier
    if(block.id == BLOCK.GRASS.id) {
        lm = biome.dirt_color;
        flags |= QUAD_FLAGS.MASK_BIOME;
    }
    let n = NORMALS.UP;
    if(block.id == BLOCK.GRASS.id) {
        y -= .15;
    }
    push_plane(vertices, x, y, z, c, lm, n, true, true, undefined, undefined, undefined, flags);
}