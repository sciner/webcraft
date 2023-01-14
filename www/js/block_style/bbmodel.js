import { calcRotateMatrix, DIRECTION, IndexedColor, mat4ToRotate, Vector } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { BLOCK, FakeTBlock } from '../blocks.js';
import { TBlock } from '../typed_blocks3.js';
import { BBModel_Model } from '../bbmodel/model.js';
import { CubeSym } from '../core/CubeSym.js';

import { default as default_style, TX_SIZE } from '../block_style/default.js';
import { default as stairs_style } from '../block_style/stairs.js';
import { default as fence_style } from '../block_style/fence.js';
import { default as pot_style } from '../block_style/pot.js';
import { default as sign_style } from '../block_style/sign.js';

import { default as glMatrix } from "../../vendors/gl-matrix-3.3.min.js";
const { mat4, vec3 } = glMatrix;
const lm = IndexedColor.WHITE;

const DEFAULT_AABB_SIZE = new Vector(12, 12, 12)
const pivotObj = new Vector(0.5, .5, 0.5)

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
        const behavior = bb.behavior || bb.model.name

        switch(behavior) {
            case 'chain': {
                const aabb_size = tblock.material.aabb_size || DEFAULT_AABB_SIZE
                const aabb = new AABB()
                aabb.set(0, 0, 0, 0, 0, 0)
                aabb
                    .translate(.5 * TX_SIZE, aabb_size.y/2, .5 * TX_SIZE)
                    .expand(aabb_size.x/2, aabb_size.y/2, aabb_size.z/2)
                    .div(TX_SIZE)
                // Rotate
                if(tblock.getCardinalDirection) {
                    const cardinal_direction = tblock.getCardinalDirection()
                    const matrix = CubeSym.matrices[cardinal_direction]
                    // on the ceil
                    if(tblock.rotate && tblock.rotate.y == -1) {
                        if(tblock.hasTag('rotate_by_pos_n')) {
                            aabb.translate(0, 1 - aabb.y_max, 0)
                        }
                    }
                    aabb.applyMatrix(matrix, pivotObj)
                }
                return [aabb]
            }
            default: {
                const styleVariant = BLOCK.styles.get(behavior)
                if(styleVariant?.aabb) {
                    return styleVariant.aabb(tblock, for_physic, world, neighbours, expanded)
                }
                break
            }
        }

        const aabb = new AABB()
        aabb.set(0, 0, 0, 1, 1, 1)

        if(!for_physic) {
            aabb.expand(1/100, 1/100, 1/100)
        }
        return [aabb]

    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined') {
            return;
        }

        const bb = block.material.bb
        /**
         * @type {BBModel_Model}
         */
        const model = bb.model

        if(!model) {
            return;
        }

        matrix = mat4.create()
        mat4.rotateY(matrix, matrix, Math.PI)

        // reset state and restore groups visibility
        model.resetBehaviorChanges()

        const emmited_blocks = style.applyBehavior(model, block, neighbours, matrix, biome, dirt_color)

        // calc rotate matrix
        style.applyRotate(model, block, neighbours, matrix)

        //
        style.postBehavior(x, y, z, model, block, neighbours, pivot, matrix, biome, dirt_color, emmited_blocks)

        // const animation_name = 'walk';
        // model.playAnimation(animation_name, performance.now() / 1000)

        const particles = []

        model.draw(vertices, new Vector(x + .5, y, z + .5), lm, matrix, (type, pos, args) => {
            if(typeof worker == 'undefined') {
                return
            }
            const p = new Vector(pos).addScalarSelf(.5, 0, .5)
            particles.push({pos: p.addSelf(block.posworld), type, args})
        })

        if(particles.length > 0) {
            worker.postMessage(['add_animated_block', {
                block_pos:  block.posworld,
                list: particles
            }]);
        }

        // Draw debug stand
        // style.drawDebugStand(vertices, pos, lm, null);

        // Add particles for block
        // style.addParticles(model, block, matrix)

        if(emmited_blocks.length > 0) {
            return emmited_blocks
        }

        return null

    }

    static applyRotate(model, tblock, neighbours, matrix) {

        const mat = tblock.material
        const bb = mat.bb

        // Rotate
        if(bb.rotate && tblock.rotate) {
            for(let rot of bb.rotate) {
                if(style.checkWhen(model, tblock, rot.when)) {
                    switch(rot.type) {
                        case 'cardinal_direction': {
                            style.rotateByCardinal4sides(model, matrix, tblock.getCardinalDirection())
                            break
                        }
                        case 'y360': {
                            mat4.rotateY(matrix, matrix, ((tblock.rotate.x - 2) / 4) * (2 * Math.PI))
                            break
                        }
                        case 'three': {
                            // rotation only in three axes X, Y or Z
                            if(tblock instanceof TBlock) {
                                const cd = tblock.getCardinalDirection()
                                const mx = calcRotateMatrix(tblock.material, tblock.rotate, cd, matrix)
                                // хак со сдвигом матрицы в центр блока
                                const v = vec3.create()
                                v[1] = 0.5
                                vec3.transformMat4(v, v, mx)
                                mx[12] += - v[0]
                                mx[13] += 0.5 - v[1]
                                mx[14] += - v[2]
                                mat4.copy(matrix, mx)
                            }
                            break
                        }
                    }
                    break
                }
            }
        }

    }

    static postBehavior(x, y, z, model, tblock, neighbours, pivot, matrix, biome, dirt_color, emmited_blocks) {

        const mat = tblock.material
        const bb = mat.bb

        switch(bb.behavior ?? bb.model.name) {
            case 'sign': {
                const m = mat4.create()
                mat4.copy(m, matrix)
                mat4.rotateY(m, m, Math.PI)
                const aabb = sign_style.makeAABBSign(tblock, x, y, z)
                const e = 0 // -1/30
                aabb.expand(e, e, e)
                const fblock = sign_style.makeTextBlock(tblock, aabb, pivot, m, x, y, z)
                if(fblock) {
                    emmited_blocks.push(fblock)
                }
                break
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
        const behavior = bb.behavior || bb.model.name
        const rotate = tblock.rotate

        switch(behavior) {
            case 'lantern': {
                const on_ceil = rotate?.y == -1;
                model.state = on_ceil ? 'ceil' : 'floor'
                model.hideAllExcept(model.state)
                break
            }
            case 'torch': {
                const on_wall = rotate && !rotate.y
                model.state = on_wall ? 'wall' : 'floor'
                model.hideAllExcept(model.state)
                break
            }
            case 'sign': {
                const on_wall = rotate && !rotate.y
                model.state = on_wall ? 'wall' : 'floor'
                model.hideAllExcept(model.state)
                model.selectTextureFromPalette(mat.name)
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
                model.selectTextureFromPalette(mat.name)
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

    /*
     * @param {BBModel_Model} model 
     * @param {TBlock} tblock
     * @param {*} matrix
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
    */

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