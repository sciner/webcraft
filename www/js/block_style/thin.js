import {DIRECTION, MULTIPLY, NORMALS, ROTATE} from '../helpers.js';
import {BLOCK} from "../blocks.js";

// Панель
export default class style {

    static getRegInfo() {
        return {
            styles: ['thin'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours) {

        if(typeof block == 'undefined') {
            return;
        }

        const cardinal_direction = block.getCardinalDirection();

        let texture     = block.material.texture;
        let bH          = 1.0;
        let lm          = MULTIPLY.COLOR.WHITE;
        let c           = BLOCK.calcTexture(texture, DIRECTION.FORWARD);

        switch(cardinal_direction) {
            case ROTATE.N:
            case ROTATE.S: {
                // Front
                let n = NORMALS.FORWARD;
                vertices.push(x + .5, z + .5, y + bH/2,
                    1, 0, 0,
                    0, 0, bH,
                    c[0], c[1], c[2], -c[3],
                    lm.r, lm.g, lm.b, 0);
                break;
            }
            case ROTATE.E:
            case ROTATE.W: {
                // Left
                let n = NORMALS.LEFT;
                vertices.push(x + .5, z + .5, y + bH/2,
                    0, 1, 0,
                    0, 0, -bH,
                    c[0], c[1], -c[2], c[3],
                    lm.r, lm.g, lm.b, 0);
                break;
            }
        }

    }

}