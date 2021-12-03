import {MULTIPLY, DIRECTION, QUAD_FLAGS} from '../helpers.js';
import { default as push_plane_style } from './plane.js';
import {CHUNK_SIZE_Z} from "../chunk.js";

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

    static func(block, vertices, chunk, x, y, z, neighbours, biome) {
        let c = BLOCK.calcTexture(block.material.texture, DIRECTION.UP);
        let lm = MULTIPLY.COLOR.WHITE;
        let flags = QUAD_FLAGS.NORMAL_UP;
        // Texture color multiplier
        if(block.hasTag('mask_biome')) {
            lm = biome.dirt_color;
            flags |= QUAD_FLAGS.MASK_BIOME;
        }
        if(block.id == BLOCK.GRASS.id) {
            y -= .15;
        }
        let sz = 1 / 1.41;
        let index = x * CHUNK_SIZE_Z + z;
        let r = 0;
        if([block.material.style].indexOf('sign') < 0) {
            if(!randoms[index]) {
                randoms[index] = Math.random();
            }
            r = randoms[index] * 4/16 - 2/16;
        } else {
            console.log('4567');
        }
        x += 0.5 - 0.5 / 1.41 + r;
        z += 0.5 - 0.5 / 1.41 + r;
        push_plane(vertices, x, y, z, c, lm, true, true, sz, undefined, sz, flags);
    }

}