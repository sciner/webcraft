import {MULTIPLY, DIRECTION, QUAD_FLAGS} from '../helpers.js';
import { default as push_plane_style } from './plane.js';
import {CHUNK_SIZE_Z} from "../blocks.js";

const push_plane = push_plane_style.getRegInfo().func;
let randoms = [];

// Растения
export default class style {

    static getRegInfo() {
        return {
            styles: ['planting', 'sign'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, lightmap, x, y, z, neighbours, biome) {
        let c = BLOCK.calcTexture(block.material.texture, DIRECTION.UP);
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
        let sz = 1 / 1.41;
        let index = x * CHUNK_SIZE_Z + z;
        if(!randoms[index]) {
            randoms[index] = Math.random();
        }
        let r = randoms[index] * 4/16 - 2/16;
        x += 0.5 - 0.5 / 1.41 + r;
        z += 0.5 - 0.5 / 1.41 + r;
        push_plane(vertices, x, y, z, c, lm, ao, true, true, sz, undefined, sz, flags);
    }

}