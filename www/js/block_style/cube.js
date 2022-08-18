"use strict";

import {DIRECTION, IndexedColor, QUAD_FLAGS, Vector, calcRotateMatrix} from '../helpers.js';
import {impl as alea} from "../../vendors/alea.js";
import {BLOCK} from "../blocks.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../chunk_const.js";
import {CubeSym} from "../core/CubeSym.js";
import { AABB, AABBSideParams, pushAABB } from '../core/AABB.js';

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

    static getRegInfo() {
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
                if(block.material.tags.indexOf('rotate_by_pos_n') >= 0 ) {
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
        return block.extra_data && block.extra_data.point.y >= .5;
    }

    //
    static putIntoPot(vertices, material, pivot, matrix, pos, biome, dirt_color) {
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
        const c_up = BLOCK.calcMaterialTexture(material, DIRECTION.UP);
        const c_down = BLOCK.calcMaterialTexture(material, DIRECTION.DOWN);
        const c_side = BLOCK.calcMaterialTexture(material, DIRECTION.LEFT);

        let flags = 0;

        // Texture color multiplier
        let lm = IndexedColor.WHITE;
        if(material.tags.indexOf('mask_biome') >= 0) {
            lm = dirt_color || IndexedColor.GRASS;
            flags = QUAD_FLAGS.MASK_BIOME;
        } else if(material.tags.indexOf('mask_color') >= 0) {
            flags = QUAD_FLAGS.MASK_BIOME;
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

    // Can draw face
    static canDrawFace(block, neighbour, drawAllSides) {
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
        if(material.style == 'ladder') {
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

        const material              = block.material;
        const no_anim               = material.is_simple_qube || !material.texture_animations;

        let width                   = 1;
        let height                  = 1;
        let depth                   = 1;
        let autoUV                  = true;
        let axes_up                 = null;
        let lm                      = IndexedColor.WHITE;
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
        let canDrawUP = height < 1 || style.canDrawFace(block, neighbours.UP, drawAllSides);
        let canDrawDOWN = style.canDrawFace(block, neighbours.DOWN, drawAllSides);
        let canDrawSOUTH = style.canDrawFace(block, neighbours.SOUTH, drawAllSides);
        let canDrawNORTH = style.canDrawFace(block, neighbours.NORTH, drawAllSides);
        let canDrawWEST = style.canDrawFace(block, neighbours.WEST, drawAllSides);
        let canDrawEAST = style.canDrawFace(block, neighbours.EAST, drawAllSides);
        if(!canDrawUP && !canDrawDOWN && !canDrawSOUTH && !canDrawNORTH && !canDrawWEST && !canDrawEAST) {
            return;
        }

        if(material.is_simple_qube) {

            force_tex = BLOCK.calcTexture(material.texture, DIRECTION.UP);

        } else {

            // Jukebox
            if(material.is_jukebox) {
                const disc = block?.extra_data?.disc || null;
                if(disc) {
                    worker.postMessage(['play_disc', {
                        ...disc,
                        dt: block.extra_data?.dt,
                        pos: chunk.coord.add(new Vector(x, y, z))
                    }]);
                }
            }

            // Leaves
            if(material.transparent && material.is_leaves) {
                if(neighbours.SOUTH.material.is_leaves) {
                    canDrawSOUTH = false;
                }
                if(neighbours.WEST.material.is_leaves) {
                    canDrawWEST = false;
                }
                if(neighbours.UP.material.is_leaves) {
                    canDrawUP = false;
                }
            }

            // Glass
            if(material.transparent && material.is_glass) {
                if(neighbours.SOUTH.material.is_glass && neighbours.SOUTH.material.style == material.style) canDrawSOUTH = false;
                if(neighbours.NORTH.material.is_glass && neighbours.NORTH.material.style == material.style) canDrawNORTH = false;
                if(neighbours.WEST.material.is_glass && neighbours.WEST.material.style == material.style) canDrawWEST = false;
                if(neighbours.EAST.material.is_glass && neighbours.EAST.material.style == material.style) canDrawEAST = false;
                if(neighbours.UP.material.is_glass && neighbours.UP.material.style == material.style) canDrawUP = false;
                if(neighbours.DOWN.material.is_glass && neighbours.DOWN.material.style == material.style) canDrawDOWN = false;
            }

            // Texture color multiplier
            if(block.hasTag('mask_biome')) {
                lm = dirt_color; // IndexedColor.GRASS;
                sideFlags = QUAD_FLAGS.MASK_BIOME;
                upFlags = QUAD_FLAGS.MASK_BIOME;
            }
            if(block.hasTag('mask_color')) {
                lm = material.mask_color;
                sideFlags = QUAD_FLAGS.MASK_BIOME;
                upFlags = QUAD_FLAGS.MASK_BIOME;
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
                        (material.tags.indexOf('rotate_by_pos_n') >= 0 && rotate.y != 0)
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
            if(material.is_dirt) {
                const up_mat = neighbours.UP?.material;
                if(up_mat && (!up_mat.transparent || up_mat.is_fluid || (up_mat.id == BLOCK.DIRT_PATH.id))) {
                    DIRECTION_UP        = DIRECTION.DOWN;
                    DIRECTION_BACK      = DIRECTION.DOWN;
                    DIRECTION_RIGHT     = DIRECTION.DOWN;
                    DIRECTION_FORWARD   = DIRECTION.DOWN;
                    DIRECTION_LEFT      = DIRECTION.DOWN;
                    sideFlags = 0;
                    upFlags = 0;
                }
            }

            // uvlock
            if(!material.uvlock) {
                axes_up = UP_AXES[cardinal_direction];
                autoUV = false;
            }

        }

        // Поворот текстуры травы в случайном направлении (для избегания эффекта мозаичности поверхности)
        if(block.id == BLOCK.GRASS_BLOCK.id || block.id == BLOCK.SAND.id) {
            const rv = randoms[(z * CHUNK_SIZE_X + x + y * CHUNK_SIZE_Y) % randoms.length] | 0;
            axes_up = UP_AXES[rv % 4];
            autoUV = false;
        }

        // Push vertices
        if(canDrawUP) {
            const anim_frames = no_anim ? 0 : BLOCK.getAnimations(material, 'up');
            const animFlag = anim_frames > 1 ? QUAD_FLAGS.FLAG_ANIMATED : 0;
            const t = force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_UP, null, null, block);
            sides.up = _sides.up.set(t, flags | upFlags | animFlag, anim_frames, lm, axes_up, autoUV);
        }
        if(canDrawDOWN) {
            const anim_frames = no_anim ? 0 : BLOCK.getAnimations(material, 'down');
            const animFlag = anim_frames > 1 ? QUAD_FLAGS.FLAG_ANIMATED : 0;
            const t = force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_DOWN, null, null, block);
            sides.down = _sides.down.set(t, flags | sideFlags | animFlag, anim_frames, lm, null, true);
        }
        if(canDrawSOUTH) {
            const anim_frames = no_anim ? 0 : BLOCK.getAnimations(material, 'south');
            const animFlag = anim_frames > 1 ? QUAD_FLAGS.FLAG_ANIMATED : 0;
            const t = force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_BACK, width, height, block);
            sides.south = _sides.south.set(t, flags | sideFlags | animFlag, anim_frames, lm, null, false);
        }
        if(canDrawNORTH) {
            const anim_frames = no_anim ? 0 : BLOCK.getAnimations(material, 'north');
            const animFlag = anim_frames > 1 ? QUAD_FLAGS.FLAG_ANIMATED : 0;
            const t = force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_FORWARD, width, height, block);
            sides.north = _sides.north.set(t, flags | sideFlags | animFlag, anim_frames, lm, null, false);
        }
        if(canDrawWEST) {
            const anim_frames = no_anim ? 0 : BLOCK.getAnimations(material, 'west');
            const animFlag = anim_frames > 1 ? QUAD_FLAGS.FLAG_ANIMATED : 0;
            const t = force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_LEFT, width, height, block);
            sides.west = _sides.west.set(t,  flags | sideFlags | animFlag, anim_frames, lm, null, false);
        }
        if(canDrawEAST) {
            const anim_frames = no_anim ? 0 : BLOCK.getAnimations(material, 'east');
            const animFlag = anim_frames > 1 ? QUAD_FLAGS.FLAG_ANIMATED : 0;
            const t = force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_RIGHT, width, height, block);
            sides.east = _sides.east.set(t, flags | sideFlags | animFlag, anim_frames, lm, null, false);
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

    }

}