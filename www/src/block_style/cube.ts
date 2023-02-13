"use strict";

import {DIRECTION, IndexedColor, QUAD_FLAGS, Vector, calcRotateMatrix, TX_CNT, Color} from '../helpers.js';
import {impl as alea} from "../../vendors/alea.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../chunk_const.js";
import {CubeSym} from "../core/CubeSym.js";
import { AABB, AABBSideParams, pushAABB } from '../core/AABB.js';
import { default as default_style } from './default.js';
import { GRASS_PALETTE_OFFSET, LEAVES_TYPE } from '../constant.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;

// Leaves
const leaves_planes = [
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, Math.PI / 2], "move": {"x": 0, "y": 0, "z": 0}},
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 4, 0], "move": {"x": 0, "y": 0, "z": 0}},
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 4 * 3, 0], "move": {"x": 0, "y": 0, "z": 0}}
];
const matrix_leaves_2 = mat4.create();
mat4.scale(matrix_leaves_2, matrix_leaves_2, [2, 2, 2]);
const matrix_leaves_sqrt2 = mat4.create();
mat4.scale(matrix_leaves_sqrt2, matrix_leaves_sqrt2, [1.4, 1.4, 1.4]);
const leaves_matrices = [matrix_leaves_sqrt2, matrix_leaves_2, matrix_leaves_2];

const _lm_grass = new IndexedColor(0, 0, 0);
const _lm_leaves = new Color(0, 0, 0, 0);
const _pl = {};
const _vec = new Vector(0, 0, 0);

export const LEAVES_COLOR_FLAGS = [
    new IndexedColor(28, 540, 0), // pink
    new IndexedColor(20, 524, 0), // orange
    new IndexedColor(28, 524, 0), // yellow
]

const pivotObj = {x: 0.5, y: .5, z: 0.5};
const DEFAULT_ROTATE = new Vector(0, 1, 0);
const _aabb = new AABB();
const _center = new Vector(0, 0, 0);
const _sides = {
    up: new AABBSideParams(),
    down: new AABBSideParams(),
    south: new AABBSideParams(),
    north: new AABBSideParams(),
    west: new AABBSideParams(),
    east: new AABBSideParams()
}

// @IMPORTANT!: No change order, because it very important for uvlock blocks
const UP_AXES = [
    [[0, 1, 0], [-1, 0, 0]],
    [[-1, 0, 0], [0, -1, 0]],
    [[0, -1, 0], [1, 0, 0]],
    [[1, 0, 0], [0, 1, 0]],
];

// Used for grass pseudo-random rotation
const randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
const a = new alea('random_dirt_rotations');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = Math.round(a.double() * 100);
}

export default class style {
    [key: string]: any;

    /**
     * @param { import("../blocks.js").BLOCK } block_manager
     * @returns
     */
    static getRegInfo(block_manager) {
        style.block_manager = block_manager
        return {
            styles: ['cube', 'default'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {
        const material = block.material;
        let width = material.width ? material.width : 1;
        let height = material.height ? material.height : 1;
        let depth = material.depth ? material.depth : width;

        if(for_physic && block.id == style.block_manager.SOUL_SAND.id) {
            height = 14/16;
        }

        // Button
        if(material.is_button) {
            if(block.extra_data?.pressed) {
                height /= 2;
            }
        }

        const x = 0;
        let y = 0;
        const z = 0;

        // Высота наслаеваемых блоков хранится в extra_data
        if(material.is_layering) {
            if(block.extra_data) {
                height = block.extra_data?.height || height;
            }
            if(material.layering.slab) {
                if(style.isOnCeil(block)) {
                    y += material.layering.height;
                }
            }
        }

        // AABB
        const aabb = new AABB();
        aabb.set(
            x + .5 - width/2,
            y,
            z + .5 - depth/2,
            x + .5 + width/2,
            y + height,
            z + .5 + depth/2
        );

        //
        if(block.getCardinalDirection) {
            const cardinal_direction = block.getCardinalDirection();
            const matrix = CubeSym.matrices[cardinal_direction];
            // on the ceil
            if(block.rotate && block.rotate.y == -1) {
                if(block.material.tags.includes('rotate_by_pos_n')) {
                    aabb.translate(0, 1 - aabb.y_max, 0)
                }
            }
            aabb.applyMatrix(matrix, pivotObj);
        }

        //
        if(!for_physic) {
            aabb.pad(1/500);
        }

        return [aabb];
    }

    static isOnCeil(block) {
        // на верхней части блока (перевернутая ступенька, слэб)
        return block.extra_data?.point?.y >= .5 ?? false;
    }

    //
    static putIntoPot(vertices, material, pivot, matrix, pos, biome, dirt_color) {
        const bm = style.block_manager
        const width = 8/32;
        const {x, y, z} = pos;
        const aabb = new AABB();
        aabb.set(
            x + .5 - width/2,
            y,
            z + .5 - width/2,
            x + .5 + width/2,
            y + 1 - 6/32,
            z + .5 + width/2
        );
        const c_up = bm.calcMaterialTexture(material, DIRECTION.UP);
        const c_down = bm.calcMaterialTexture(material, DIRECTION.DOWN);
        const c_side = bm.calcMaterialTexture(material, DIRECTION.LEFT);

        let flags = 0;

        // Texture color multiplier
        let lm = IndexedColor.WHITE;
        if(material.tags.includes('mask_biome')) {
            lm = dirt_color || IndexedColor.GRASS;
            flags = QUAD_FLAGS.MASK_BIOME;
        } else if(material.tags.includes('mask_color')) {
            flags = QUAD_FLAGS.FLAG_MASK_COLOR_ADD;
            lm = material.mask_color;
        }

        // Push vertices down
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_up, flags, 0, lm, null, true),
                down:   new AABBSideParams(c_down, flags, 0, lm, null, true),
                south:  new AABBSideParams(c_side, flags, 0, lm, null, true),
                north:  new AABBSideParams(c_side, flags, 0, lm, null, true),
                west:   new AABBSideParams(c_side, flags, 0, lm, null, true),
                east:   new AABBSideParams(c_side, flags, 0, lm, null, true),
            },
            pos
        );
        return;
    }

    /**
     * Can draw face
     * @param {*} block
     * @param {*} neighbour
     * @param {boolean} drawAllSides
     * @param {int} dir
     * @returns
     */
    static canDrawFace(block, neighbour, drawAllSides, dir) {
        if(!neighbour) {
            return true;
        }
        const bmat = block.material;
        const nmat = neighbour.material;
        let resp = drawAllSides || (nmat && nmat.transparent);
        if(resp) {
            if(block.id == neighbour.id && bmat.selflit) {
                resp = false;
            } else if(bmat.is_water && nmat.is_water) {
                return false;
            } else if(nmat.is_solid && dir == DIRECTION.DOWN) {
                if(bmat.layering) {
                    if(bmat.extra_data?.point && bmat.extra_data?.point.y < .5) return false
                    return true;
                }
                return false;
            } else if(nmat.id == bmat.id && bmat.layering && !block.extra_data) {
                return false;
            }
        }
        return resp;
    }

    // calculateBlockSize...
    static calculateBlockSize(block, neighbours) {
        const material  = block.material;
        let width       = material.width ? material.width : 1;
        let height      = material.height ? material.height : 1;
        let depth       = material.depth ? material.depth : width;
        const up_mat    = neighbours.UP ? neighbours.UP.material : null;
        // Ladder
        if(material.style_name == 'ladder') {
            width = 1;
            height = 1;
            depth = 1;
        }
        // Button
        if(material.is_button) {
            if(block.extra_data?.pressed) {
                height /= 2;
            }
        } else if(material.is_fluid) {
            if(up_mat && up_mat.is_fluid) {
                height = 1.0;
            } else {
                height = .9;
            }
        }
        // Layering
        if(material.is_layering) {
            if(block.extra_data) {
                height = block.extra_data?.height || height;
            }
        }
        if(material.is_dirt) {
            if(up_mat && (!up_mat.transparent || up_mat.is_fluid || neighbours.UP.material.is_dirt)) {
                height = 1;
            }
        }
        return {width, height, depth};
    }

    // Pushes the vertices necessary for rendering a specific block into the array.
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {

        // Pot
        if(block.hasTag('into_pot')) {
            return style.putIntoPot(vertices, block.material, pivot, matrix, _center.set(x, y, z), biome, dirt_color);
        }

        const bm                    = style.block_manager
        const material              = block.material;
        const no_anim               = material.is_simple_qube || !material.texture_animations;

        // Beautiful leaves
        const sheared = (block?.extra_data?.sheared) ? block?.extra_data?.sheared : false;
        if(material.transparent && material.is_leaves == LEAVES_TYPE.BEAUTIFUL && !sheared) {
            const leaves_tex = bm.calcTexture(material.texture, 'round');
            _lm_leaves.copyFrom(dirt_color);
            // _lm_leaves.r += (Math.random() - Math.random()) * 24;
            // _lm_leaves.g += (Math.random() - Math.random()) * 24;
            _lm_leaves.b = leaves_tex[3] * TX_CNT;
            const r1 = (randoms[(z * 13 + x * 3 + y * 23) % randoms.length] | 0) / 100;
            const r2 = (randoms[(z * 11 + x * 37 + y) % randoms.length] | 0) / 100;
            // Shift the horizontal plane randomly, to prevent a visible big plane.
            // Alternate shift by 0.25 block up/down from the center + some random.
            leaves_planes[0].move.y = ((x + z) % 2 - 0.5) * 0.5 + (r2 - 0.5) * 0.3;
            let flag = QUAD_FLAGS.MASK_BIOME | QUAD_FLAGS.FLAG_LEAVES
            if(block.extra_data) {
                if(block.extra_data && block.extra_data.v != undefined) {
                    const color = LEAVES_COLOR_FLAGS[block.extra_data.v % LEAVES_COLOR_FLAGS.length]
                    _lm_leaves.r = color.r
                    _lm_leaves.g = color.g
                }
            }
            for(let i = 0; i < leaves_planes.length; i++) {
                const plane = leaves_planes[i];
                // fill object
                _pl.size     = plane.size;
                _pl.uv       = plane.uv;
                _pl.rot      = [Math.PI*2 * r1, plane.rot[1] + r2 * 0.01, plane.rot[2]];
                _pl.lm       = _lm_leaves;
                _pl.pos      = _vec.set(
                    x + (plane.move?.x || 0),
                    y + (plane.move?.y || 0),
                    z + (plane.move?.z || 0)
                );
                _pl.matrix   = leaves_matrices[i];
                _pl.flag     = flag;
                _pl.texture  = leaves_tex;
                default_style.pushPlane(vertices, _pl);
            }
            return;
        }

        let width                   = 1;
        let height                  = 1;
        let depth                   = 1;
        let autoUV                  = true;
        let axes_up                 = null;
        let axes_down               = null;
        let lm                      = _lm_grass.copyFrom(IndexedColor.WHITE);
        let flags                   = material.light_power ? QUAD_FLAGS.NO_AO : 0;
        let sideFlags               = flags;
        let upFlags                 = flags;
        const sides                 = {};

        let DIRECTION_UP            = DIRECTION.UP;
        let DIRECTION_DOWN          = DIRECTION.DOWN;
        let DIRECTION_BACK          = DIRECTION.BACK
        let DIRECTION_RIGHT         = DIRECTION.RIGHT
        let DIRECTION_FORWARD       = DIRECTION.FORWARD
        let DIRECTION_LEFT          = DIRECTION.LEFT;

        if(!material.is_simple_qube) {
            const sz = style.calculateBlockSize(block, neighbours);
            width = sz.width;
            height = sz.height;
            depth = sz.depth;
        }

        //
        const drawAllSides = (width != 1 || height != 1) && !material.is_water;
        let canDrawUP = height < 1 || style.canDrawFace(block, neighbours.UP, drawAllSides, DIRECTION.UP);
        let canDrawDOWN = style.canDrawFace(block, neighbours.DOWN, drawAllSides, DIRECTION.DOWN);
        let canDrawSOUTH = style.canDrawFace(block, neighbours.SOUTH, drawAllSides, DIRECTION.SOUTH);
        let canDrawNORTH = style.canDrawFace(block, neighbours.NORTH, drawAllSides, DIRECTION.NORTH);
        let canDrawWEST = style.canDrawFace(block, neighbours.WEST, drawAllSides, DIRECTION.WEST);
        let canDrawEAST = style.canDrawFace(block, neighbours.EAST, drawAllSides, DIRECTION.EAST);
        if(!canDrawUP && !canDrawDOWN && !canDrawSOUTH && !canDrawNORTH && !canDrawWEST && !canDrawEAST) {
            return;
        }

        if(material.is_simple_qube) {

            force_tex = bm.calcTexture(material.texture, DIRECTION.UP);

        } else {

            // Glass
            if(material.transparent && material.is_glass) {
                if(neighbours.SOUTH.material.is_glass && neighbours.SOUTH.material.style_name == material.style_name) canDrawSOUTH = false;
                if(neighbours.NORTH.material.is_glass && neighbours.NORTH.material.style_name == material.style_name) canDrawNORTH = false;
                if(neighbours.WEST.material.is_glass && neighbours.WEST.material.style_name == material.style_name) canDrawWEST = false;
                if(neighbours.EAST.material.is_glass && neighbours.EAST.material.style_name == material.style_name) canDrawEAST = false;
                if(neighbours.UP.material.is_glass && neighbours.UP.material.style_name == material.style_name) canDrawUP = false;
                if(neighbours.DOWN.material.is_glass && neighbours.DOWN.material.style_name == material.style_name) canDrawDOWN = false;
            }

            if(material.draw_only_down) {
                canDrawUP = false;
                canDrawSOUTH = false;
                canDrawNORTH = false;
                canDrawWEST = false;
                canDrawEAST = false;
            }

            // Texture color multiplier
            if(block.hasTag('mask_biome')) {
                lm.copyFrom(dirt_color)
                if(block.id == bm.GRASS_BLOCK.id) {
                    lm.r += GRASS_PALETTE_OFFSET;
                }
                sideFlags = QUAD_FLAGS.MASK_BIOME;
                upFlags = QUAD_FLAGS.MASK_BIOME;
            }
            if(block.hasTag('mask_color')) {
                lm = material.mask_color;
                sideFlags = QUAD_FLAGS.FLAG_MASK_COLOR_ADD;
                upFlags = QUAD_FLAGS.FLAG_MASK_COLOR_ADD;
            }
            if(block.hasTag('multiply_color')) {
                lm = material.multiply_color;
                flags |= QUAD_FLAGS.FLAG_MULTIPLY_COLOR;
            }

            // Rotate
            const rotate = block.rotate || DEFAULT_ROTATE;
            let cardinal_direction = block.getCardinalDirection();

            // Can rotate
            if(material.can_rotate && rotate) {

                if(rotate.x != 0 || rotate.y != 1 || rotate.z != 0) {
                    matrix = calcRotateMatrix(material, rotate, cardinal_direction, matrix);
                    DIRECTION_BACK          = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.BACK);
                    DIRECTION_RIGHT         = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.RIGHT);
                    DIRECTION_FORWARD       = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.FORWARD);
                    DIRECTION_LEFT          = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.LEFT);
                    //
                    if (
                        CubeSym.matrices[cardinal_direction][4] <= 0 ||
                        (material.tags.includes('rotate_by_pos_n') && rotate.y != 0)
                    ) {
                        // @todo: calculate canDrawUP and neighbours based on rotation
                        canDrawUP = true;
                        canDrawDOWN = true;
                        canDrawSOUTH = true;
                        canDrawNORTH = true;
                        canDrawWEST = true;
                        canDrawEAST = true;
                        DIRECTION_BACK = DIRECTION.BACK;
                        DIRECTION_RIGHT = DIRECTION.RIGHT;
                        DIRECTION_FORWARD = DIRECTION.FORWARD;
                        DIRECTION_LEFT = DIRECTION.LEFT;
                    }
                }
            }

            // Layering
            if(material.is_layering) {
                if(material.layering.slab) {
                    if(style.isOnCeil(block)) {
                        y += material.layering.height;
                    }
                }
            }

            // Убираем шапку травы с дерна, если над ним есть непрозрачный блок
            let replace_side_tex = false;
            if(material.is_dirt && ('height' in material)) {
                const up_mat = neighbours.UP?.material;
                if(up_mat && (!up_mat.transparent || up_mat.is_fluid || (up_mat.id == bm.DIRT_PATH.id))) {
                    replace_side_tex = true;
                }
            }
            if(material.name == 'SANDSTONE') {
                const up_mat = neighbours.UP?.material;
                if(up_mat && up_mat.name == 'SANDSTONE') {
                    replace_side_tex = true;
                }
            }
            if(replace_side_tex) {
                DIRECTION_UP        = DIRECTION.DOWN;
                DIRECTION_BACK      = DIRECTION.DOWN;
                DIRECTION_RIGHT     = DIRECTION.DOWN;
                DIRECTION_FORWARD   = DIRECTION.DOWN;
                DIRECTION_LEFT      = DIRECTION.DOWN;
                sideFlags = 0;
                upFlags = 0;
            }

            // uvlock
            if(!material.uvlock) {
                axes_up = UP_AXES[cardinal_direction];
                autoUV = false;
            }

        }

        // Поворот текстуры травы в случайном направлении (для избегания эффекта мозаичности поверхности)
        if(material.random_rotate_up) {
            const rv = randoms[(z * CHUNK_SIZE_X + x + y * CHUNK_SIZE_Y) % randoms.length] | 0;
            if(block.id == bm.LILY_PAD.id) {
                axes_down = UP_AXES[rv % 4];
                flags |= QUAD_FLAGS.FLAG_WAVES_VERTEX;
            } else {
                axes_up = UP_AXES[rv % 4];
            }
            autoUV = false;
        }

        //
        const calcSideParams = (side, dir, width, height) => {
            const anim_frames = no_anim ? 0 : bm.getAnimations(material, side);
            const animFlag = anim_frames > 1 ? QUAD_FLAGS.FLAG_ANIMATED : 0;
            if(material.name == 'FURNACE' && dir == DIRECTION.NORTH) {
                const fuel_time = block?.extra_data?.state?.fuel_time ?? 0;
                if(fuel_time > 0) {
                    dir = 'north_on';
                }
            }
            const t = force_tex || bm.calcMaterialTexture(material, dir, width, height, block);
            const f = flags | upFlags | sideFlags | animFlag;
            if((f & QUAD_FLAGS.MASK_BIOME) == QUAD_FLAGS.MASK_BIOME) {
                lm.b = t[3] * TX_CNT;
            }
            return {anim_frames, t, f};
        };

        // Push vertices
        if(canDrawUP) {
            const {anim_frames, t, f} = calcSideParams('up', DIRECTION_UP, null, null);
            sides.up = _sides.up.set(t, f, anim_frames, lm, axes_up, autoUV);
        }
        if(canDrawDOWN) {
            const {anim_frames, t, f} = calcSideParams('down', DIRECTION_DOWN, null, null);
            sides.down = _sides.down.set(t, f, anim_frames, lm, axes_down, true);
        }
        if(canDrawSOUTH) {
            const {anim_frames, t, f} = calcSideParams('south', DIRECTION_BACK, width, height);
            sides.south = _sides.south.set(t, f, anim_frames, lm, null, false);
        }
        if(canDrawNORTH) {
            const {anim_frames, t, f} = calcSideParams('north', DIRECTION_FORWARD, width, height);
            sides.north = _sides.north.set(t, f, anim_frames, lm, null, false);
        }
        if(canDrawWEST) {
            const {anim_frames, t, f} = calcSideParams('west', DIRECTION_LEFT, width, height);
            sides.west = _sides.west.set(t,  f, anim_frames, lm, null, false);
        }
        if(canDrawEAST) {
            const {anim_frames, t, f} = calcSideParams('east', DIRECTION_RIGHT, width, height);
            sides.east = _sides.east.set(t, f, anim_frames, lm, null, false);
        }

        // AABB
        _aabb.set(
            x + .5 - width/2,
            y,
            z + .5 - depth/2,
            x + .5 + width/2,
            y + height,
            z + .5 + depth/2
        );

        pushAABB(vertices, _aabb, pivot, matrix, sides, _center.set(x, y, z));

        // Add animations
        if(typeof worker != 'undefined' && block.id == bm.SOUL_SAND.id) {
            if (neighbours.UP?.id == bm.BUBBLE_COLUMN.id) {
                worker.postMessage(['add_animated_block', {
                    block_pos: block.posworld,
                    pos: [block.posworld.add(new Vector(.5, .5, .5))],
                    type: 'bubble_column',
                    isBottom: true
                }]);
            } else {
                worker.postMessage(['delete_animated_block', block.posworld]);
            }
        }

        // Jukebox
        if(block.id == bm.JUKEBOX.id) {
            style.playJukeboxDisc(chunk, block, x, y, z)
        }

    }

    /**
     * @param {*} chunk
     * @param {*} tblock
     * @param {int} x
     * @param {int} y
     * @param {int} z
     * @returns {boolean}
     */
    static playJukeboxDisc(chunk, tblock, x, y, z) {
        if(typeof worker === 'undefined') {
            return false
        }
        const disc = tblock?.extra_data?.disc || null;
        if(disc) {
            worker.postMessage(['play_disc', {
                ...disc,
                dt: tblock.extra_data?.dt,
                pos: chunk.coord.add(new Vector(x, y, z))
            }]);
            worker.postMessage(['add_animated_block', {
                block_pos: tblock.posworld,
                pos: [tblock.posworld.add(new Vector(.5, .5, .5))],
                type: 'music_note'
            }]);
        }
        return true
    }

}