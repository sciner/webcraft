"use strict";

import {DIRECTION, MULTIPLY, QUAD_FLAGS, Vector, calcRotateMatrix} from '../helpers.js';
import {impl as alea} from "../../vendors/alea.js";
import {BLOCK, WATER_BLOCKS_ID} from "../blocks.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../chunk.js";
import {CubeSym} from "../core/CubeSym.js";
import { AABB, AABBSideParams, pushAABB } from '../core/AABB.js';

let DIRT_BLOCKS = null;
const pivotObj = {x: 0.5, y: .5, z: 0.5};
const DEFAULT_ROTATE = new Vector(0, 1, 0);

const UP_AXES = [
    [[0, -1, 0], [1, 0, 0]],
    [[-1, 0, 0], [0, -1, 0]],
    [[0, 1, 0], [-1, 0, 0]],
    [[1, 0, 0], [0, 1, 0]],
];

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_dirt_rotations');
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
            if(block.extra_data.pressed) {
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
        let aabb = new AABB();
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
            let cardinal_direction = block.getCardinalDirection();
            let matrix = CubeSym.matrices[cardinal_direction];
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
    static putIntoPot(vertices, material, pivot, matrix, pos, biome) {
        const width = 8/32;
        const {x, y, z} = pos;
        let aabb = new AABB();
        aabb.set(
            x + .5 - width/2,
            y,
            z + .5 - width/2,
            x + .5 + width/2,
            y + 1 - 6/32,
            z + .5 + width/2
        );
        let c_up = BLOCK.calcMaterialTexture(material, DIRECTION.UP);
        let c_down = BLOCK.calcMaterialTexture(material, DIRECTION.DOWN);
        let c_side = BLOCK.calcMaterialTexture(material, DIRECTION.LEFT);

        let flags = 0;

        // Texture color multiplier
        let lm = MULTIPLY.COLOR.WHITE;
        if(material.tags.indexOf('mask_biome') >= 0) {
            lm = biome?.dirt_color || MULTIPLY.COLOR.GRASS;
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
                up:     new AABBSideParams(c_up, flags, 1, lm, null, true),
                down:   new AABBSideParams(c_down, flags, 1, lm, null, true),
                south:  new AABBSideParams(c_side, flags, 1, lm, null, true),
                north:  new AABBSideParams(c_side, flags, 1, lm, null, true),
                west:   new AABBSideParams(c_side, flags, 1, lm, null, true),
                east:   new AABBSideParams(c_side, flags, 1, lm, null, true),
            },
            pos
        );
        return;
    }

    // getAnimations...
    static getAnimations(material, side) {
        if(!material.texture_animations) {
            return 1;
        }
        if(side in material.texture_animations) {
            return material.texture_animations[side];
        } else if('side' in material.texture_animations) {
            return material.texture_animations['side'];
        }
        return 1;
    }

    // Can draw face
    static canDrawFace(block, material, neighbourBlock, drawAllSides) {
        if(!neighbourBlock) {
            return true;
        }
        let resp = drawAllSides || neighbourBlock.material?.transparent;
        if(resp) {
            if(block.id == neighbourBlock.id && material.selflit) {
                resp = false;
            } else {
                if(WATER_BLOCKS_ID.indexOf(block.id) >= 0 && WATER_BLOCKS_ID.indexOf(neighbourBlock.id) >= 0) {
                    return false;
                }
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
        // Ladder
        if(material.style == 'ladder') {
            width = 1;
            height = 1;
            depth = 1;
        }
        // Button
        if(material.is_button) {
            if(block.extra_data.pressed) {
                height /= 2;
            }
        } else if(material.is_fluid) {
            if(neighbours.UP && neighbours.UP.material.is_fluid) {
                height = 1.0;
            } else {
                height = Math.min(block.power, .9);
            }
        }
        // Layering
        if(material.is_layering) {
            if(block.extra_data) {
                height = block.extra_data?.height || height;
            }
        }
        //
        if(!DIRT_BLOCKS) {
            DIRT_BLOCKS = [BLOCK.GRASS_DIRT.id, BLOCK.DIRT_PATH.id, BLOCK.SNOW_DIRT.id, BLOCK.PODZOL.id];
        }
        if(DIRT_BLOCKS.indexOf(block.id) >= 0) {
            if(neighbours.UP && neighbours.UP.material && (!neighbours.UP.material.transparent || neighbours.UP.material.is_fluid || (neighbours.UP.id == BLOCK.DIRT_PATH.id))) {
                height = 1;
            }
        }
        return {width, height, depth};
    }

    // Pushes the vertices necessary for rendering a specific block into the array.
    static func(block, vertices, chunk, x, y, z, neighbours, biome, unknown, matrix = null, pivot = null, force_tex) {

        const material                  = block.material;

        // Pot
        if(block.hasTag('into_pot')) {
            return style.putIntoPot(vertices, material, pivot, matrix, new Vector(x, y, z), biome);
        }

        const {width, height, depth}    = style.calculateBlockSize(block, neighbours);
        const drawAllSides              = width != 1 || height != 1;
        let flags                       = material.light_power ? QUAD_FLAGS.NO_AO : 0;
        let sideFlags                   = flags;
        let upFlags                     = flags;
        let autoUV                      = true;

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

        //
        let canDrawUP = style.canDrawFace(block, material, neighbours.UP, drawAllSides) || height < 1;
        let canDrawDOWN = style.canDrawFace(block, material, neighbours.DOWN, drawAllSides);
        let canDrawSOUTH = style.canDrawFace(block, material, neighbours.SOUTH, drawAllSides);
        let canDrawNORTH = style.canDrawFace(block, material, neighbours.NORTH, drawAllSides);
        let canDrawWEST = style.canDrawFace(block, material, neighbours.WEST, drawAllSides);
        let canDrawEAST = style.canDrawFace(block, material, neighbours.EAST, drawAllSides);
        if(!canDrawUP && !canDrawDOWN && !canDrawSOUTH && !canDrawNORTH && !canDrawWEST && !canDrawEAST) {
            return;
        }

        // Leaves
        if(material.transparent && material.tags.indexOf('leaves') >= 0) {
            if(neighbours.SOUTH.material.tags.indexOf('leaves') > 0) {
                canDrawSOUTH = false;
            }
            if(neighbours.WEST.material.tags.indexOf('leaves') > 0) {
                canDrawWEST = false;
            }
            if(neighbours.UP.material.tags.indexOf('leaves') > 0) {
                canDrawUP = false;
            }
        }

        // Glass
        if(material.transparent && material.tags.indexOf('glass') >= 0) {
            if(neighbours.SOUTH.material.tags.indexOf('glass') >= 0) canDrawSOUTH = false;
            if(neighbours.NORTH.material.tags.indexOf('glass') >= 0) canDrawNORTH = false;
            if(neighbours.WEST.material.tags.indexOf('glass') >= 0) canDrawWEST = false;
            if(neighbours.EAST.material.tags.indexOf('glass') >= 0) canDrawEAST = false;
            if(neighbours.UP.material.tags.indexOf('glass') >= 0) canDrawUP = false;
            if(neighbours.DOWN.material.tags.indexOf('glass') >= 0) canDrawDOWN = false;
        }

        // Texture color multiplier
        let lm = MULTIPLY.COLOR.WHITE;
        if(block.hasTag('mask_biome')) {
            lm = biome.dirt_color; // MULTIPLY.COLOR.GRASS;
            sideFlags = QUAD_FLAGS.MASK_BIOME;
            upFlags = QUAD_FLAGS.MASK_BIOME;
        }
        if(block.hasTag('mask_color')) {
            lm = material.mask_color;
            sideFlags = QUAD_FLAGS.MASK_BIOME;
            upFlags = QUAD_FLAGS.MASK_BIOME;
        }

        let DIRECTION_UP            = DIRECTION.UP;
        let DIRECTION_DOWN          = DIRECTION.DOWN;
        let DIRECTION_BACK          = DIRECTION.BACK
        let DIRECTION_RIGHT         = DIRECTION.RIGHT
        let DIRECTION_FORWARD       = DIRECTION.FORWARD
        let DIRECTION_LEFT          = DIRECTION.LEFT;

        // Rotate
        const rotate = block.rotate || DEFAULT_ROTATE;
        let cardinal_direction      = block.getCardinalDirection();
        matrix = calcRotateMatrix(material, rotate, cardinal_direction, matrix);

        // Can rotate
        if(material.can_rotate && rotate) {
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

        // Layering
        if(material.is_layering) {
            if(block.properties.layering.slab) {
                if(style.isOnCeil(block)) {
                    y += block.properties.layering.height;
                }
            }
        }

        // Убираем шапку травы с дерна, если над ним есть непрозрачный блок
        if(DIRT_BLOCKS.indexOf(block.id) >= 0) {
            if(neighbours.UP && neighbours.UP.material && (!neighbours.UP.material.transparent || neighbours.UP.material.is_fluid || (neighbours.UP.id == BLOCK.DIRT_PATH.id))) {
                DIRECTION_UP        = DIRECTION.DOWN;
                DIRECTION_BACK      = DIRECTION.DOWN;
                DIRECTION_RIGHT     = DIRECTION.DOWN;
                DIRECTION_FORWARD   = DIRECTION.DOWN;
                DIRECTION_LEFT      = DIRECTION.DOWN;
                sideFlags = 0;
                upFlags = 0;
            }
        }

        // AABB
        let aabb = new AABB();
        aabb.set(
            x + .5 - width/2,
            y,
            z + .5 - depth/2,
            x + .5 + width/2,
            y + height,
            z + .5 + depth/2
        );

        // Поворот текстуры травы в случайном направлении (для избегания эффекта мозаичности поверхности)
        let axes_up = null;
        if(block.id == BLOCK.GRASS_DIRT.id || block.id == BLOCK.SAND.id) {
            const rv = randoms[(z * CHUNK_SIZE_X + x + y * CHUNK_SIZE_Y) % randoms.length] | 0;
            axes_up = UP_AXES[rv % 4];
            autoUV = false;
        }

        // Push vertices
        const sides = {};
        if(canDrawUP) sides.up = new AABBSideParams(force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_UP, null, null, block), flags | upFlags, style.getAnimations(material, 'up'), lm, axes_up, autoUV);
        if(canDrawDOWN) sides.down = new AABBSideParams(force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_DOWN, null, null, block), flags | sideFlags, style.getAnimations(material, 'down'), lm, null, true);
        if(canDrawSOUTH) sides.south = new AABBSideParams(force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_BACK, null, 1, block), flags | sideFlags, style.getAnimations(material, 'south'), lm, null, true);
        if(canDrawNORTH) sides.north = new AABBSideParams(force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_FORWARD, null, 1, block), flags | sideFlags, style.getAnimations(material, 'north'), lm, null, true);
        if(canDrawWEST) sides.west = new AABBSideParams(force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_LEFT, null, 1, block),  flags | sideFlags, style.getAnimations(material, 'west'), lm, null, true);
        if(canDrawEAST) sides.east = new AABBSideParams(force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_RIGHT, null, 1, block), flags | sideFlags, style.getAnimations(material, 'east'), lm, null, true);
        pushAABB(vertices, aabb, pivot, matrix, sides, new Vector(x, y, z));

    }

}