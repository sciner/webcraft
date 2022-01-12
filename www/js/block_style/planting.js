import {MULTIPLY, DIRECTION, QUAD_FLAGS, Color} from '../helpers.js';
import { default as push_plane_style } from './plane.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk.js";
import {BLOCK} from "../blocks.js";
import {impl as alea} from "../../vendors/alea.js";

const push_plane = push_plane_style.getRegInfo().func;

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

// Растения
export default class style {

    static lm = new Color();

    static getRegInfo() {
        return {
            styles: ['planting', 'sign'],
            func: this.func
        };
    }

    // getAnimations...
    static getAnimations(block, side) {
        if(!block.material.texture_animations) {
            return 1;
        }
        if(side in block.material.texture_animations) {
            return block.material.texture_animations[side];
        } else if('side' in block.material.texture_animations) {
            return block.material.texture_animations['side'];
        }
        return 1;
    };

    static func(block, vertices, chunk, x, y, z, neighbours, biome) {
        let c = BLOCK.calcTexture(block.material.texture, DIRECTION.UP);
        style.lm.set(MULTIPLY.COLOR.WHITE);
        let flags = QUAD_FLAGS.NORMAL_UP;
        // Texture color multiplier
        if(block.hasTag('mask_biome')) {
            style.lm.set(biome.dirt_color);
            flags |= QUAD_FLAGS.MASK_BIOME;
        }
        if(block.id == BLOCK.GRASS.id || block.id == BLOCK.TALL_GRASS.id || block.id == BLOCK.TALL_GRASS_TOP.id) {
            y -= .15;
        }
        let sz = 1 / 1.41;
        let index = Math.abs(Math.round(x * CHUNK_SIZE_Z + z)) % 256;
        let r = 0;
        if([block.material.style].indexOf('sign') < 0) {
            r = randoms[index] * 4/16 - 2/16;
        }
        x += 0.5 - 0.5 / 1.41 + r;
        z += 0.5 - 0.5 / 1.41 + r;
        style.lm.b = style.getAnimations(block, 'up');
        push_plane(vertices, x, y, z, c, style.lm, true, true, sz, undefined, sz, flags);
    }

}