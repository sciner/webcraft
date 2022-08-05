import {DIRECTION, MULTIPLY, NORMALS, QUAD_FLAGS, ROTATE} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import { CubeSym } from '../core/CubeSym.js';

// Панель
export default class style {

    static getRegInfo() {
        return {
            styles: ['thin'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(typeof block == 'undefined') {
            return;
        }

        const cardinal_direction = block.getCardinalDirection();

        const material  = block.material;
        let texture     = material.texture;
        let bH          = 1.0;
        let lm          = MULTIPLY.COLOR.WHITE;
        let c           = BLOCK.calcTexture(texture, DIRECTION.FORWARD);
        let flags       = 0;

        // Animations
        const anim_frames = BLOCK.getAnimations(material, 'up');
        if(anim_frames > 0) {
            lm.b = anim_frames;
            flags |= QUAD_FLAGS.FLAG_ANIMATED;
        }

        switch(cardinal_direction) {
            case CubeSym.ROT_Z:
            case ROTATE.N:
            case ROTATE.S: {
                // Front
                vertices.push(x + .5, z + .5, y + bH/2,
                    1, 0, 0,
                    0, 0, bH,
                    c[0], c[1], c[2], -c[3],
                    lm.r, lm.g, lm.b, flags);
                break;
            }
            case CubeSym.ROT_X:
            case ROTATE.E:
            case ROTATE.W: {
                // Left
                let n = NORMALS.LEFT;
                vertices.push(x + .5, z + .5, y + bH/2,
                    0, 1, 0,
                    0, 0, -bH,
                    c[0], c[1], -c[2], c[3],
                    lm.r, lm.g, lm.b, flags);
                break;
            }
        }

    }

}