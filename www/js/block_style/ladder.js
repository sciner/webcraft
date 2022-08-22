import {DIRECTION, IndexedColor, QUAD_FLAGS} from '../helpers.js';
import {pushSym} from '../core/CubeSym.js';
import {BLOCK} from "../blocks.js";

// Лестница
export default class style {

    static getRegInfo() {
        return {
            styles: ['ladder'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {

        if(typeof block == 'undefined') {
            return;
        }

        const cardinal_direction = block.getCardinalDirection();

        let texture     = block.material.texture;
        let bH          = 1.0;
        let width       = block.material.width ? block.material.width : 1;
        let lm          = IndexedColor.WHITE;
        let c           = null;
        let flags       = 0;

        // Texture color multiplier
        c = BLOCK.calcTexture(texture, DIRECTION.BACK);
        let pp = IndexedColor.packLm(lm);

        pushSym(vertices, cardinal_direction,
            x + .5, z + .5, y + .5,
            0, width - .5, bH / 2 - .5,
            1, 0, 0,
            0, 0, -bH,
            c[0], c[1], -c[2], c[3],
            pp, flags);
    }

}