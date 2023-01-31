import { calcRotateMatrix, DIRECTION, IndexedColor, mat4ToRotate, StringHelpers, Vector } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { BLOCK, FakeTBlock, FakeVertices } from '../blocks.js';
import { TBlock } from '../typed_blocks3.js';
import { BBModel_Model } from '../bbmodel/model.js';
import { CubeSym } from '../core/CubeSym.js';

import { default as default_style, TX_SIZE } from '../block_style/default.js';
import { default as stairs_style } from '../block_style/stairs.js';
import { default as fence_style } from '../block_style/fence.js';
import { default as cube_style } from '../block_style/cube.js';
import { default as pot_style } from '../block_style/pot.js';
import { default as cauldron_style } from '../block_style/cauldron.js';
import { default as sign_style } from '../block_style/sign.js';

import { default as glMatrix } from "../../vendors/gl-matrix-3.3.min.js";
import { CHUNK_SIZE_X, CHUNK_SIZE_Z } from '../chunk_const.js';
import {impl as alea} from "../../vendors/alea.js";
const { mat4, vec3 } = glMatrix;
const lm = IndexedColor.WHITE;

const DEFAULT_AABB_SIZE = new Vector(12, 12, 12)
const pivotObj = new Vector(0.5, .5, 0.5)
const xyz = new Vector(0, 0, 0)

// randoms
const RANDOMS_COUNT = CHUNK_SIZE_X * CHUNK_SIZE_Z
const randoms = new Array(RANDOMS_COUNT)
const a = new alea('randoms')
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double()
}

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

        xyz.set(x, y, z)
        const emmited_blocks = style.applyBehavior(model, chunk, block, neighbours, matrix, biome, dirt_color, vertices, xyz)
        x = xyz.x
        y = xyz.y
        z = xyz.z

        // calc rotate matrix
        style.applyRotate(model, block, neighbours, matrix, x, y, z)

        //
        style.postBehavior(x, y, z, model, block, neighbours, pivot, matrix, biome, dirt_color, emmited_blocks)

        // Select texture
        if(bb.select_texture) {
            for(let st of bb.select_texture) {
                if(style.checkWhen(model, block, st.when)) {
                    style.selectTextureFromPalette(model, st, block)
                }
            }
        }

        // const animation_name = 'walk';
        // model.playAnimation(animation_name, performance.now() / 1000)

        // Add particles for block
        const particles = []
        model.draw(vertices, new Vector(x + .5, y, z + .5), lm, matrix, (type, pos, args) => {
            if(typeof worker == 'undefined') {
                return
            }
            const p = new Vector(pos).addScalarSelf(.5, 0, .5)
            particles.push({pos: p.addSelf(block.posworld), type, args})
        })
        style.addParticles(model, block, matrix, particles)
        if(particles.length > 0) {
            worker.postMessage(['add_animated_block', {
                block_pos:  block.posworld,
                list: particles
            }]);
        }

        // Draw debug stand
        // style.drawDebugStand(vertices, pos, lm, null);

        if(emmited_blocks.length > 0) {
            return emmited_blocks
        }

        return null

    }

    static applyRotate(model, tblock, neighbours, matrix, x, y, z) {

        const mat = tblock.material
        const bb = mat.bb

        // Rotate
        if(bb.rotate) {
            for(let rot of bb.rotate) {
                if(style.checkWhen(model, tblock, rot.when)) {
                    switch(rot.type) {
                        case 'cardinal_direction': {
                            style.rotateByCardinal4sides(model, matrix, tblock.getCardinalDirection())
                            break
                        }
                        case 'fixed_cardinal_direction': {
                            style.rotateByCardinal4sides(model, matrix, rot.value)
                            break
                        }
                        case 'y360': {
                            if(tblock.rotate) {
                                mat4.rotateY(matrix, matrix, ((tblock.rotate.x - 2) / 4) * (2 * Math.PI))
                            }
                            break
                        }
                        case 'ydeg': {
                            if(tblock.rotate) {
                                mat4.rotateY(matrix, matrix, ((tblock.rotate.x - 180) / 180) * Math.PI)
                            }
                            break
                        }
                        case 'random': {
                            for(let axe of rot.axes) {
                                switch(axe) {
                                    case 'y': {
                                        const random_index = Math.abs(Math.round(x * CHUNK_SIZE_Z + z)) % randoms.length;
                                        mat4.rotateY(matrix, matrix, randoms[random_index] * (2 * Math.PI))
                                        break
                                    }
                                    default: {
                                        throw 'error_not_implemented'
                                    }
                                }
                            }
                            break
                        }
                        case 'three': {
                            // rotation only in three axes X, Y or Z
                            if(tblock.rotate && tblock instanceof TBlock) {
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
     * @param {*} chunk 
     * @param {TBlock} tblock 
     * @param {*} neighbours 
     * @param {*} matrix 
     * @param {*} biome 
     * @param {IndexedColor} dirt_color
     * @param {float[]} vertices
     * @param {Vector} xyz
     */
    static applyBehavior(model, chunk, tblock, neighbours, matrix, biome, dirt_color, vertices, xyz) {

        const emmited_blocks = []
        const mat = tblock.material
        const bb = mat.bb
        const behavior = bb.behavior || bb.model.name
        const rotate = tblock.rotate

        // 1.
        if(bb.set_state /* && !(tblock instanceof FakeTBlock) */) {
            for(let state of bb.set_state) {
                if(style.checkWhen(model, tblock, state.when)) {
                    model.state = state.name
                    model.hideAllExcept([model.state])
                    break
                }
            }
        }

        // 2.
        switch(behavior) {
            case 'jukebox': {
                cube_style.playJukeboxDisc(chunk, tblock, xyz.x, xyz.y, xyz.z)
                break
            }
            case 'door': {
                const extra_data = tblock.extra_data ?? {opened: false, left: true}
                const rotate = tblock.rotate ?? Vector.ZERO
                const is_left = extra_data.left
                const shift = 7/16 * (is_left ? 1 : -1)
                const move_back = !(tblock instanceof FakeTBlock)
                if(extra_data) {
                    if(!is_left) {
                        mat4.rotateY(matrix, matrix, Math.PI)
                    }
                    if(extra_data?.opened) {
                        mat4.rotateY(matrix, matrix, Math.PI/2 * (is_left ? -1 : 1))
                    }
                    switch(rotate.x) {
                        case DIRECTION.SOUTH: {
                            xyz.x -= shift
                            if(move_back) xyz.z -= 7/16
                            break
                        }
                        case DIRECTION.NORTH: {
                            xyz.x += shift
                            if(move_back) xyz.z += 7/16
                            break
                        }
                        case DIRECTION.WEST: {
                            xyz.z += shift
                            if(move_back) xyz.x -= 7/16
                            break
                        }
                        case DIRECTION.EAST: {
                            xyz.z -= shift
                            if(move_back) xyz.x += 7/16
                            break
                        }
                    }
                }
                break
            }
            case 'cactus': {
                if(!(tblock instanceof FakeTBlock)) {
                    if(neighbours.UP && neighbours.UP.id != tblock.id) {
                        model.hideAllExcept(['top'])
                    }
                }
                if(tblock.extra_data?.into_pot) {
                    // mat4.copy(matrix, tblock.matrix)
                    mat4.scale(matrix, matrix, [.5, .5, .5])
                    mat4.translate(matrix, matrix, [0, .5, 0]);
                }
                break
            }
            case 'age': {
                const age = Math.min((tblock?.extra_data?.stage ?? 0), mat.ticking.max_stage) + 1
                model.state = `age${age}`
                model.hideAllExcept([model.state])
                break
            }
            case "pane": {
                const except_list = ['column']
                if (BLOCK.canPaneConnect(neighbours.EAST)) except_list.push('east')
                if (BLOCK.canPaneConnect(neighbours.WEST)) except_list.push('west')
                if (BLOCK.canPaneConnect(neighbours.SOUTH)) except_list.push('south')
                if (BLOCK.canPaneConnect(neighbours.NORTH)) except_list.push('north')
                model.hideAllExcept(except_list)
                break
            }
            case 'chest': {
                const type = tblock.extra_data?.type ?? null
                const is_big = !!type

                /*
                if(typeof worker != 'undefined') {
                    worker.postMessage(['add_bbmesh', {
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
                style.selectTextureFromPalette(model, {name: mat.name}, tblock)
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
            case 'cauldron': {
                if(tblock.extra_data) {
                    const vert = []
                    cauldron_style.func(tblock, vert, null, xyz.x, xyz.y, xyz.z, neighbours, biome, dirt_color, undefined, matrix, undefined, null, true)
                    emmited_blocks.push(new FakeVertices(BLOCK.STONE.material_key, vert))
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
     */
    static addParticles(model, tblock, matrix, particles) {
        if(typeof worker == 'undefined') {
            return
        }
        const mat = tblock.material
        const block_particles = mat.bb?.particles
        if(!block_particles) {
            return
        }
        //
        for(let particle of block_particles) {
            if(style.checkWhen(model, tblock, particle.when)) {
                const args = null
                for(let item of particle.list) {
                    const p = new Vector(item).addScalarSelf(-.5, 0, -.5)
                    const arr = p.toArray()
                    vec3.transformMat4(arr, arr, matrix)
                    p.set(arr[0], arr[1], arr[2]).addScalarSelf(.5, 0, .5)
                    particles.push({pos: p.addSelf(tblock.posworld), type: item.type, args})
                }
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
                    if(model.state !== condition_value) {
                        return false
                    }
                    break
                }
                case 'rotate.y': {
                    if(tblock.rotate?.y !== condition_value) {
                        return false
                    }
                    break
                }
                default: {
                    if(k.startsWith('extra_data.')) {
                        const key = k.substring(11)
                        const value = tblock.extra_data ? (tblock.extra_data[key] ?? null) : null
                        if(Array.isArray(condition_value)) {
                            if(!condition_value.includes(value)) {
                                return false
                            }
                        } else {
                            if(condition_value != value) {
                                return false
                            }
                        }
                    }
                }
            }
        }
        return true
    }

    static selectTextureFromPalette(model, texture, tblock) {
        //
        const makeTextureName = (name) => {
            if(!name) {
                return 
            }
            if(tblock && tblock.material) {
                name = name.replace('%block_name%', tblock.material.name)
                if(name.startsWith('%extra_data.')) {
                    const field_name = StringHelpers.trim(name.substring(12), '%')
                    name = null
                    if(tblock.extra_data) {
                        name = tblock.extra_data[field_name]
                    }
                }
            }
            return name
        }
        //
        const texture_name = makeTextureName(texture.name) || makeTextureName(texture.empty)
        if(texture_name) {
            model.selectTextureFromPalette(texture.group, texture_name)
        }
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