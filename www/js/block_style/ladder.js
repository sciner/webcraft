import {MULTIPLY, ROTATE, DIRECTION, QUAD_FLAGS} from '../helpers.js';
import {pushSym} from '../core/CubeSym.js';
import {BLOCK, NEIGHB_BY_SYM} from "../blocks.js";

// Лестница
export default class style {

    static getRegInfo() {
        return {
            styles: ['ladder'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, _unknown, matrix = null, pivot = null, force_tex) {

        if(typeof block == 'undefined') {
            return;
        }

        const cardinal_direction = block.getCardinalDirection();

        let texture     = block.material.texture;
        let bH          = 1.0;
        let width       = block.material.width ? block.material.width : 1;
        let lm          = MULTIPLY.COLOR.WHITE;
        let c           = null;
        let flags       = 0;

        // Texture color multiplier
        if(block.id == BLOCK.VINES.id) {
            // c = BLOCK.calcTexture(texture, DIRECTION.UP);
            c = BLOCK.calcTexture(texture, DIRECTION.BACK);
            lm = biome.dirt_color;
            // flags = QUAD_FLAGS.NORMAL_UP;
            flags = QUAD_FLAGS.MASK_BIOME;
        } else {
            c = BLOCK.calcTexture(texture, DIRECTION.BACK);
        }

        pushSym(vertices, cardinal_direction,
            x + .5, z + .5, y + .5,
            0, width - .5, bH / 2 - .5,
            1, 0, 0,
            0, 0, -bH,
            c[0], c[1], -c[2], c[3],
            lm.r, lm.g, lm.b,
            flags);
    }

}