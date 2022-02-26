"use strict";

import {DIRECTION, MULTIPLY, QUAD_FLAGS, Vector} from '../helpers.js';
import {impl as alea} from "../../vendors/alea.js";
import {BLOCK, WATER_BLOCKS_ID} from "../blocks.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../chunk.js";
import {CubeSym} from "../core/CubeSym.js";
import { AABB, AABBSideParams, pushAABB } from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat3} = glMatrix;

const tempMatrix = mat3.create();
let DIRT_BLOCKS = null;
const pivotObj = {x: 0.5, y: .5, z: 0.5};

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
        if(material.layering) {
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
        if(block.getCardinalDirection) {
            let cardinal_direction = block.getCardinalDirection();
            aabb.applyMatrix(CubeSym.matrices[cardinal_direction], pivotObj);
        }
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
    static putIntoPot(vertices, material, pivot, matrix, pos) {
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
        // Push vertices down
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_up, 0, 1),
                down:   new AABBSideParams(c_down, 0, 1),
                south:  new AABBSideParams(c_side, 0, 1),
                north:  new AABBSideParams(c_side, 0, 1),
                west:   new AABBSideParams(c_side, 0, 1),
                east:   new AABBSideParams(c_side, 0, 1),
            },
            true,
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

    // Pushes the vertices necessary for rendering a specific block into the array.
    static func(block, vertices, chunk, x, y, z, neighbours, biome, unknown, matrix = null, pivot = null, force_tex) {

        const material              = block.material;
        let width                   = material.width ? material.width : 1;
        let height                  = material.height ? material.height : 1;
        let depth                   = material.depth ? material.depth : width;
        const drawAllSides          = width != 1 || height != 1;

        // Pot
        if(block.hasTag('into_pot')) {
            return style.putIntoPot(vertices, material, pivot, matrix, new Vector(x, y, z));
        }

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

        // Button
        if(material.is_button) {
            if(block.extra_data.pressed) {
                height /= 2;
            }
        }

        // Can draw face
        let canDrawFace = (neighbourBlock) => {
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
        };

        // Can change height
        let bH = 1.0;
        if(material.is_fluid) {
            bH = Math.min(block.power, .9)
            let blockOver = neighbours.UP;
            if(blockOver) {
                if(blockOver.material.is_fluid) {
                    bH = 1.0;
                }
            }
            block.bH = bH;
        }

        //
        let canDrawUP = canDrawFace(neighbours.UP) || bH < 1;
        let canDrawDOWN = canDrawFace(neighbours.DOWN);
        let canDrawSOUTH = canDrawFace(neighbours.SOUTH);
        let canDrawNORTH = canDrawFace(neighbours.NORTH);
        let canDrawWEST = canDrawFace(neighbours.WEST);
        let canDrawEAST = canDrawFace(neighbours.EAST);
        if(!canDrawUP && !canDrawDOWN && !canDrawSOUTH && !canDrawNORTH && !canDrawWEST && !canDrawEAST) {
            return;
        }

        // Leaves
        if(material.tags.indexOf('leaves') >= 0) {
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

        const cardinal_direction    = block.getCardinalDirection();
        let flags                   = material.light_power ? QUAD_FLAGS.NO_AO : 0;
        let sideFlags               = flags;
        let upFlags                 = flags;

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

        // Can rotate
        if(material.can_rotate) {
            DIRECTION_BACK          = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.BACK);
            DIRECTION_RIGHT         = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.RIGHT);
            DIRECTION_FORWARD       = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.FORWARD);
            DIRECTION_LEFT          = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.LEFT);
            //
            if(block.rotate) {
                if (CubeSym.matrices[cardinal_direction][4] <= 0) {
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
                    // Use matrix instead!
                    if (matrix) {
                        mat3.multiply(tempMatrix, matrix, CubeSym.matrices[cardinal_direction]);
                        matrix = tempMatrix;
                    } else {
                        matrix = CubeSym.matrices[cardinal_direction];
                    }
                }
            }
        }

        // Ladder
        if(material.style == 'ladder') {
            width = 1;
            height = 1;
            depth = 1;
        }

        // Layering
        if(material.layering) {
            if(block.extra_data) {
                height = block.extra_data?.height || height;
            }
            if(block.properties.layering.slab) {
                if(style.isOnCeil(block)) {
                    y += block.properties.layering.height;
                }
            }
        }

        // Убираем шапку травы с дерна, если над ним есть непрозрачный блок
        if(!DIRT_BLOCKS) {
            DIRT_BLOCKS = [BLOCK.DIRT.id, BLOCK.DIRT_PATH.id, BLOCK.SNOW_DIRT.id];
        }
        if(DIRT_BLOCKS.indexOf(block.id) >= 0) {
            if(neighbours.UP && neighbours.UP.material && (!neighbours.UP.material.transparent || neighbours.UP.material.is_fluid || (neighbours.UP.id == BLOCK.DIRT_PATH.id))) {
                DIRECTION_UP        = DIRECTION.DOWN;
                DIRECTION_BACK      = DIRECTION.DOWN;
                DIRECTION_RIGHT     = DIRECTION.DOWN;
                DIRECTION_FORWARD   = DIRECTION.DOWN;
                DIRECTION_LEFT      = DIRECTION.DOWN;
                sideFlags = 0;
                height = 1;
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
        if(block.id == BLOCK.DIRT.id || block.id == BLOCK.SAND.id) {
            const rv = randoms[(z * CHUNK_SIZE_X + x + y * CHUNK_SIZE_Y) % randoms.length] % 4;
            axes_up = UP_AXES[rv];
        }

        // Push vertices
        const sides = {};
        if(canDrawUP) sides.up = new AABBSideParams(force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_UP), flags | upFlags, style.getAnimations(material, 'up'), lm, axes_up);
        if(canDrawDOWN) sides.down = new AABBSideParams(force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_DOWN), flags | sideFlags, style.getAnimations(material, 'down'), lm);
        if(canDrawSOUTH) sides.south = new AABBSideParams(force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_BACK, null, 1), flags | sideFlags, style.getAnimations(material, 'south'), lm);
        if(canDrawNORTH) sides.north = new AABBSideParams(force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_FORWARD, null, 1), flags | sideFlags, style.getAnimations(material, 'north'), lm);
        if(canDrawWEST) sides.west = new AABBSideParams(force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_LEFT, null, 1), flags | sideFlags, style.getAnimations(material, 'west'), lm);
        if(canDrawEAST) sides.east = new AABBSideParams(force_tex || BLOCK.calcMaterialTexture(material, DIRECTION_RIGHT, null, 1), flags | sideFlags, style.getAnimations(material, 'east'), lm);
        pushAABB(vertices, aabb, pivot, matrix, sides, true, new Vector(x, y, z));

    }

}