import {MULTIPLY, ROTATE, DIRECTION, QUAD_FLAGS} from '../helpers.js';

// Лестница
export default class style {

    static getRegInfo() {
        return {
            styles: ['ladder'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome) {

        if(typeof block == 'undefined') {
            return;
        }

        const cardinal_direction = block.getCardinalDirection().z;

        let texture     = block.material.texture;
        let bH          = 1.0;
        let width       = block.material.width ? block.material.width : 1;
        let lm          = MULTIPLY.COLOR.WHITE;
        let c           = null;
        let flags       = 0;

        // Texture color multiplier
        if(block.id == BLOCK.VINES.id) {
            // c = BLOCK.calcTexture(texture, DIRECTION.UP);
            c = BLOCK.calcTexture(texture, DIRECTION.FORWARD);
            lm = biome.dirt_color;
            // flags = QUAD_FLAGS.NORMAL_UP;
            flags = QUAD_FLAGS.MASK_BIOME;
        } else {
            c = BLOCK.calcTexture(texture, DIRECTION.FORWARD);
        }

        switch(cardinal_direction) {
            case ROTATE.S: {
                // Front / NORMALS.FORWARD;
                vertices.push(x + .5, z + 1 - width, y + bH / 2,
                    1, 0, 0,
                    0, 0, bH,
                    c[0], c[1], c[2], -c[3],
                    lm.r, lm.g, lm.b,
                    flags);
                break;
            }
            case ROTATE.W: {
                // Left / NORMALS.LEFT;
                vertices.push(x + 1 - width, z + .5, y + bH / 2,
                    0, 1, 0,
                    0, 0, -bH,
                    c[0], c[1], -c[2], c[3],
                    lm.r, lm.g, lm.b,
                    flags);
                break;
            }
            case ROTATE.N: {
                // Back / NORMALS.BACK;
                vertices.push(x + .5, z + width, y + bH / 2,
                    1, 0, 0,
                    0, 0, -bH,
                    c[0], c[1], -c[2], c[3],
                    lm.r, lm.g, lm.b,
                    flags);
                break;
            }
            case ROTATE.E: {
                // Right / NORMALS.RIGHT;
                vertices.push(x + width, z + .5, y + bH / 2,
                    0, 1, 0,
                    0, 0, bH,
                    c[0], c[1], c[2], -c[3],
                    lm.r, lm.g, lm.b,
                    flags);
                break;
            }
        }

    }

}