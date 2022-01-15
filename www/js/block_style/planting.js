import {MULTIPLY, DIRECTION, QUAD_FLAGS, Color} from '../helpers.js';
import { pushPlanedGeom } from './plane.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk.js";
import {BLOCK} from "../blocks.js";
import {impl as alea} from "../../vendors/alea.js";
import { CubeSym } from '../core/CubeSym.js';

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
        let cardinal_direction = 0;
        const { rotate } = block;

        if (rotate && rotate.y !== 1 && block.material.can_rotate) {
            cardinal_direction = CubeSym.add(CubeSym.ROT_X3, block.getCardinalDirection());
        }

        let dx = 0, dy = 0, dz = 0;
        let c = BLOCK.calcTexture(block.material.texture, DIRECTION.UP);
        let flags = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP;

        style.lm.set(MULTIPLY.COLOR.WHITE);

        // Texture color multiplier
        if(block.hasTag('mask_biome')) {
            style.lm.set(biome.dirt_color);
            flags |= QUAD_FLAGS.MASK_BIOME;
        }
        if(block.id == BLOCK.GRASS.id || block.id == BLOCK.TALL_GRASS.id || block.id == BLOCK.TALL_GRASS_TOP.id) {
            dy = -.15;
        }

        let sz = 1 / 1.41;
        let index = Math.abs(Math.round(x * CHUNK_SIZE_Z + z)) % 256;
        let r = 0;

        if([block.material.style].indexOf('sign') < 0) {
            r = randoms[index] * 4/16 - 2/16;
        }

        dx = 0.5 - 0.5 + r;
        dz = 0.5 - 0.5 + r;

        style.lm.b = style.getAnimations(block, 'up');
        pushPlanedGeom(
            vertices,
            x, y, z, c,
            style.lm, true, true, 1, 1, 1, flags, 
            cardinal_direction,
            dx, dy, dz
        );
    }

}