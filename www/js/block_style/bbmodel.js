import { DIRECTION, IndexedColor, Vector } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { BLOCK } from '../blocks.js';
import { Resources } from '../resources.js';

import { default as default_style } from '../block_style/default.js';
import { default as glMatrix } from "../../vendors/gl-matrix-3.3.min.js"

const {mat4}    = glMatrix;
const lm        = IndexedColor.WHITE;

let models = null;
Resources.loadBBModels().then((res) => {
    models = res;
})

// Block model
export default class style {

    static getRegInfo() {
        return {
            styles: ['bbmodel'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    static computeAABB(block, for_physic) {
        const aabb = new AABB();
        aabb.set(0, 0, 0, 1, 1, 1);
        return [aabb];
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined') {
            return;
        }

        const model = models.get(block.material.texture.id);

        if(!model) {
            return;
        }

        matrix = mat4.create();

        switch(block.getCardinalDirection()) {
            case DIRECTION.NORTH:
                mat4.rotateY(matrix, matrix, Math.PI);
                break;
            case DIRECTION.WEST:
                mat4.rotateY(matrix, matrix, Math.PI / 2);
                break;
            case DIRECTION.EAST:
                mat4.rotateY(matrix, matrix, -Math.PI / 2);
                break;
        }

        // const animation_name = 'walk';
        // model.playAnimation(animation_name, performance.now() / 1000);
        model.draw(vertices, new Vector(x + .5, y, z + .5), lm, matrix);

        // Draw debug stand
        // style.drawDebugStand(vertices, pos, lm, null);

    }

    // Stand
    static drawDebugStand(vertices, pos, lm, matrix) {
        const flag = 0;
        const stone = BLOCK.calcTexture(BLOCK.STONE.texture, DIRECTION.WEST);
        const stand = [];
        stand.push(...[
            // stand
            {
                "size": {"x": 16, "y": .5, "z": 16},
                "translate": {"x":0, "y": -7.5, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": stone},
                    "down": {"uv": [8, 8], "flag": flag, "texture": stone},
                    "north": {"uv": [8, 8], "flag": flag, "texture": stone},
                    "south": {"uv": [8, 8], "flag": flag, "texture": stone},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": stone},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": stone}
                }
            }
        ]);
        for(const el of stand) {
            default_style.pushPART(vertices, {
                ...el,
                lm:         lm,
                pos:        pos,
                matrix:     matrix
            });
        }
    }

}