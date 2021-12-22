import {MULTIPLY, DIRECTION, QUAD_FLAGS, Color} from '../helpers.js';
import { default as push_plane_style } from './plane.js';
import {CHUNK_SIZE_Z} from "../chunk.js";

const push_plane = push_plane_style.getRegInfo().func;
let randoms = [];

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
        style.lm.set(MULTIPLY.COLOR.WHITE.r, MULTIPLY.COLOR.WHITE.g, MULTIPLY.COLOR.WHITE.b, MULTIPLY.COLOR.WHITE.a);
        // let lm = MULTIPLY.COLOR.WHITE;
        let flags = QUAD_FLAGS.NORMAL_UP;
        // Texture color multiplier
        if(block.hasTag('mask_biome')) {
            // lm = biome.dirt_color;
            style.lm.set(biome.dirt_color.r, biome.dirt_color.g, biome.dirt_color.b, biome.dirt_color.a);
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
        }
        x += 0.5 - 0.5 / 1.41 + r;
        z += 0.5 - 0.5 / 1.41 + r;
        style.lm.b = style.getAnimations(block, 'up');
        push_plane(vertices, x, y, z, c, style.lm, true, true, sz, undefined, sz, flags);
    }

}