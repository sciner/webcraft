import { DIRECTION, IndexedColor, Vector } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { BLOCK } from '../blocks.js';
import { Resources } from '../resources.js';

import { default as default_style } from '../block_style/default.js';
import { default as glMatrix } from "../../vendors/gl-matrix-3.3.min.js"
import { TBlock } from '../typed_blocks3.js';
import { BBModel_Model } from '../bbmodel/model.js';

const {mat4, vec3}    = glMatrix;
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

        const bb = block.material.bb
        /**
         * @type {BBModel_Model}
         */
        const model = models.get(bb.model)

        if(!model) {
            return;
        }

        matrix = mat4.create();

        style.applyBehavior(model, block, neighbours, matrix)

        // const animation_name = 'walk';
        // model.playAnimation(animation_name, performance.now() / 1000);
        model.draw(vertices, new Vector(x + .5, y, z + .5), lm, matrix);

        // Draw debug stand
        // style.drawDebugStand(vertices, pos, lm, null);

        // Add particles for block
        style.addParticles(model, block, matrix)

    }

    /**
     * @param {BBModel_Model} model 
     * @param {TBlock} tblock 
     * @param {*} neighbours 
     * @param {*} matrix 
     */
    static applyBehavior(model, tblock, neighbours, matrix) {

        const mat = tblock.material
        const bb = mat.bb
        const behavior = bb.behavior || bb.model
        const rotate = tblock.rotate

        model.resetBehaviorChanges()

        switch(behavior) {
            case 'torch': {
                const on_wall = rotate && !rotate.y
                model.setState(on_wall ? 'wall' : 'floor')
                break
            }
        }

        // Rotate
        if(bb.rotate) {
            if(!bb.rotate.when || style.checkWhen(model, tblock, bb.rotate.when)) {
                switch(bb.rotate.type) {
                    case 'cardinal_direction': {
                        style.rotateByCardinal4sides(model, matrix, tblock.getCardinalDirection())
                        break
                    }
                }
            }
        }

    }

    /**
     * @param {BBModel_Model} model
     * @param {*} matrix 
     * @param {int} cd 
     */
    static rotateByCardinal4sides(model, matrix, cd) {
        // model.model_rotate.set(0, cd * -(Math.PI / 2), 0)
        switch(cd) {
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
    }

    /**
     * @param {BBModel_Model} model 
     * @param {TBlock} tblock 
     * @returns 
     */
    static addParticles(model, tblock, matrix) {
        if(typeof worker == 'undefined') {
            return
        }
        const mat = tblock.material
        const particles = mat.bb?.particles
        if(!particles) {
            return
        }
        //
        for(let particle of particles) {
            if(!particle.when || style.checkWhen(model, tblock, particle.when)) {
                const poses = [];
                for(let pos of particle.pos) {
                    const p = new Vector(pos)
                    p.x -= .5
                    p.z -= .5
                    let arr = p.toArray();
                    vec3.transformMat4(arr, arr, matrix);
                    // if(model.model_rotate.y != 0) {
                    // }
                    p.set(arr[0], arr[1], arr[2]);
                    p.x += .5
                    p.z += .5
                    poses.push(p.addSelf(tblock.posworld))
                }
                worker.postMessage(['add_animated_block', {
                    block_pos:  tblock.posworld,
                    pos:        poses,
                    type:       particle.type
                }]);
            }
        }
    }

    /**
     * @param {BBModel_Model} model 
     * @param {TBlock} tblock 
     * @param {TBlock} when 
     * @returns {boolean}
     */
    static checkWhen(model, tblock, when) {
        for(let k in when) {
            const condition_value = when[k]
            switch(k) {
                case 'state': {
                    if(model.state != condition_value) {
                        return false
                    }
                }
            }
        }
        return true
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