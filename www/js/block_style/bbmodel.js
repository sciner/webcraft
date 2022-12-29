import { DIRECTION, IndexedColor, Vector } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { BLOCK } from '../blocks.js';
import { Resources } from '../resources.js';

import { default as default_style } from '../block_style/default.js';
import { default as stairs_style } from '../block_style/stairs.js';
import { default as fence_style } from '../block_style/fence.js';

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

    /**
     * @param {TBlock} tblock 
     * @param {boolean} for_physic
     * 
     * @returns {AABB[]}
     */
    static computeAABB(tblock, for_physic, world, neighbours, expanded) {
        const bb = tblock.material.bb
        const behavior = bb.behavior || bb.model

        const styleVariant = BLOCK.styles.get(behavior);
        if(styleVariant?.aabb) {
            return styleVariant.aabb(tblock, for_physic, world, neighbours, expanded)
        }

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
        mat4.rotateY(matrix, matrix, Math.PI);

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
                model.state = on_wall ? 'wall' : 'floor'
                model.hideAllExcept(model.state)
                break
            }
            case 'fence': {
                const hide_group_names = [];
                if(!BLOCK.canFenceConnect(neighbours.SOUTH)) hide_group_names.push('south')
                if(!BLOCK.canFenceConnect(neighbours.NORTH)) hide_group_names.push('north')
                if(!BLOCK.canFenceConnect(neighbours.WEST)) hide_group_names.push('west')
                if(!BLOCK.canFenceConnect(neighbours.EAST)) hide_group_names.push('east')
                model.hideGroups(hide_group_names)
                break
            }
            case 'pot': {
                break
            }
            case 'stairs': {

                const info = stairs_style.calculate(tblock, Vector.ZERO.clone(), neighbours)
                const on_ceil = info.on_ceil
                const cd = 0 // on_ceil ? 2 : 0 // tblock.getCardinalDirection()
                const fix_rot = on_ceil ? Math.PI / 2 : 0

                const s = (DIRECTION.SOUTH + cd) % 4
                const e = (DIRECTION.EAST + cd) % 4
                const n = (DIRECTION.NORTH + cd) % 4
                const w = (DIRECTION.WEST + cd) % 4

                const sw = info.sides[s]
                const se = info.sides[e]
                const en = info.sides[n]
                const nw = info.sides[w]

                // between
                if(sw && se && !en && !nw) {
                    mat4.rotateY(matrix, matrix, Math.PI)
                    model.hideGroups(['inner', 'outer'])
                } else if(en && se && !sw && !nw) {
                    mat4.rotateY(matrix, matrix, Math.PI / 2)
                    model.hideGroups(['inner', 'outer'])
                } else if(!en && !se && sw && nw) {
                    mat4.rotateY(matrix, matrix, -Math.PI / 2)
                    model.hideGroups(['inner', 'outer'])
                } else if(!sw && !se && en && nw) {
                    model.hideGroups(['inner', 'outer'])
                }

                // outer
                if(se && !sw && !en && !nw) {
                    mat4.rotateY(matrix, matrix, Math.PI / 2 + fix_rot)
                    model.hideGroups(['between', 'inner'])
                } else if(!se && sw && !en && !nw) {
                    mat4.rotateY(matrix, matrix, Math.PI + fix_rot)
                    model.hideGroups(['between', 'inner'])
                } else if(!se && !sw && !en && nw) {
                    // only nw
                    mat4.rotateY(matrix, matrix, -Math.PI / 2 + fix_rot) // + Math.PI/2
                    model.hideGroups(['between', 'inner'])
                } else if(!se && !sw && en && !nw) {
                    // only en
                    mat4.rotateY(matrix, matrix, fix_rot)
                    model.hideGroups(['between', 'inner'])
                }

                // inner
                if(!nw && se && sw && en) {
                    mat4.rotateY(matrix, matrix, Math.PI / 2 + fix_rot)
                    model.hideGroups(['between', 'outer'])
                } else if(nw && se && sw && !en) {
                    mat4.rotateY(matrix, matrix, Math.PI + fix_rot)
                    model.hideGroups(['between', 'outer'])
                } else if(nw && !se && sw && en) {
                    mat4.rotateY(matrix, matrix, -Math.PI / 2 + fix_rot)
                    model.hideGroups(['between', 'outer'])
                } else if(nw && se && !sw && en) {
                    mat4.rotateY(matrix, matrix, fix_rot)
                    model.hideGroups(['between', 'outer'])
                }

                if(on_ceil) {
                    mat4.translate(matrix, matrix, [0, 1, 0]);
                    mat4.rotateZ(matrix, matrix, Math.PI)
                }

                break
            }
        }

        // Rotate
        if(bb.rotate) {
            if(style.checkWhen(model, tblock, bb.rotate.when)) {
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
            if(style.checkWhen(model, tblock, particle.when)) {
                const poses = []
                for(let pos of particle.pos) {
                    const p = new Vector(pos).addScalarSelf(-.5, 0, -.5)
                    const arr = p.toArray()
                    vec3.transformMat4(arr, arr, matrix)
                    p.set(arr[0], arr[1], arr[2]).addScalarSelf(.5, 0, .5)
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
     * @param {object} when
     * 
     * @returns {boolean}
     */
    static checkWhen(model, tblock, when) {
        if(!when) {
            return true
        }
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