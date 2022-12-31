import { DIRECTION, IndexedColor, mat4ToRotate, Vector } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { BLOCK, FakeTBlock } from '../blocks.js';
import { Resources } from '../resources.js';
import { default as glMatrix } from "../../vendors/gl-matrix-3.3.min.js"

import { default as default_style } from '../block_style/default.js';
import { default as stairs_style } from '../block_style/stairs.js';
import { default as fence_style } from '../block_style/fence.js';
import { default as pot_style } from '../block_style/pot.js';
import { TBlock } from '../typed_blocks3.js';
import { BBModel_Model } from '../bbmodel/model.js';

const {mat4, vec3} = glMatrix;
const lm = IndexedColor.WHITE;

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

        style.applyRotate(model, block, neighbours, matrix)

        const emmited_blocks = style.applyBehavior(model, block, neighbours, matrix, biome, dirt_color)

        // const animation_name = 'walk';
        // model.playAnimation(animation_name, performance.now() / 1000);
        model.draw(vertices, new Vector(x + .5, y, z + .5), lm, matrix);

        // Draw debug stand
        // style.drawDebugStand(vertices, pos, lm, null);

        // Add particles for block
        style.addParticles(model, block, matrix)

        if(emmited_blocks.length > 0) {
            return emmited_blocks
        }

        return null

    }

    static applyRotate(model, tblock, neighbours, matrix) {

        const mat = tblock.material
        const bb = mat.bb

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
     * @param {TBlock} tblock 
     * @param {*} neighbours 
     * @param {*} matrix 
     * @param {*} biome 
     * @param {IndexedColor} dirt_color
     */
    static applyBehavior(model, tblock, neighbours, matrix, biome, dirt_color) {

        const emmited_blocks = []
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
            case 'chest': {
                const type = tblock.extra_data?.type ?? null
                const is_big = !!type

                /*
                if(typeof worker != 'undefined') {
                    worker.postMessage(['add_bbmodel', {
                        block_pos:          tblock.posworld.clone().addScalarSelf(0, 1, 0),
                        model:              model.name,
                        animation_name:     null,
                        extra_data:         tblock.extra_data,
                        rotate:             mat4ToRotate(matrix)
                    }]);
                }
                */

                if(is_big) {
                    if(type == 'left') {
                        model.hideGroups(['small', 'big'])
                    } else {
                        model.hideGroups(['small'])
                    }
                } else {
                    model.hideGroups(['big'])
                }

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
                if(!(tblock instanceof FakeTBlock)) {
                    emmited_blocks.push(...pot_style.emmitInpotBlock(tblock.vec.x, tblock.vec.y, tblock.vec.z, tblock, null, matrix, biome, dirt_color))
                }
                break
            }
            case 'stairs': {

                const info      = stairs_style.calculate(tblock, Vector.ZERO.clone(), neighbours)
                const on_ceil   = info.on_ceil
                const fix_rot   = on_ceil ? Math.PI / 2 : 0
                const sw        = !!info.sides[DIRECTION.SOUTH]
                const se        = !!info.sides[DIRECTION.EAST]
                const en        = !!info.sides[DIRECTION.NORTH]
                const nw        = !!info.sides[DIRECTION.WEST]

                let rotY        = 0

                const rules = [
                    // between
                    [0, 1, 1, 0, ['inner', 'outer'], Math.PI],
                    [1, 1, 0, 0, ['inner', 'outer'], Math.PI / 2],
                    [0, 0, 1, 1, ['inner', 'outer'], -Math.PI / 2],
                    [1, 0, 0, 1, ['inner', 'outer'], 0],
                    // outer
                    [0, 1, 0, 0, ['between', 'inner'], Math.PI / 2 + fix_rot],
                    [0, 0, 1, 0, ['between', 'inner'], Math.PI + fix_rot],
                    [0, 0, 0, 1, ['between', 'inner'], -Math.PI / 2 + fix_rot],
                    [1, 0, 0, 0, ['between', 'inner'], fix_rot],
                    // inner
                    [1, 1, 1, 0, ['between', 'outer'], Math.PI / 2 + fix_rot],
                    [0, 1, 1, 1, ['between', 'outer'], Math.PI + fix_rot],
                    [1, 0, 1, 1, ['between', 'outer'], -Math.PI / 2 + fix_rot],
                    [1, 1, 0, 1, ['between', 'outer'], fix_rot],
                ]

                for(let rule of rules) {
                    if(en == rule[0] && se == rule[1] && sw == rule[2] && nw == rule[3]) {
                        model.hideGroups(rule[4])
                        rotY = rule[5]
                        break
                    }
                }

                if(rotY) {
                    mat4.rotateY(matrix, matrix, rotY)
                }

                if(on_ceil) {
                    mat4.translate(matrix, matrix, [0, 1, 0]);
                    mat4.rotateZ(matrix, matrix, Math.PI)
                }

                break
            }
        }

        return emmited_blocks

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