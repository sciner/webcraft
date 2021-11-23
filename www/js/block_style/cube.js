"use strict";

import {DIRECTION, MULTIPLY, QUAD_FLAGS, ROTATE} from '../helpers.js';
import {impl as alea} from "../../vendors/alea.js";
import {BLOCK} from "../blocks.js";

export default class style {

    static getRegInfo() {
        return {
            styles: ['cube', 'torch', 'default'],
            func: this.func
        };
    }

    // Pushes the vertices necessary for rendering a specific block into the array.
    static func(block, vertices, chunk, x, y, z, neighbours, biome) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        const cardinal_direction    = block.getCardinalDirection();
        let flags                   = 0;
        let sideFlags               = 0;
        let upFlags                 = 0;

        // Texture color multiplier
        let lm = MULTIPLY.COLOR.WHITE;
        if(block.hasTag('mask_biome')) {
            lm = biome.dirt_color; // MULTIPLY.COLOR.GRASS;
            sideFlags = QUAD_FLAGS.MASK_BIOME;
            upFlags = QUAD_FLAGS.MASK_BIOME;
        }

        let DIRECTION_UP            = DIRECTION.UP;
        let DIRECTION_DOWN          = DIRECTION.DOWN;
        let DIRECTION_BACK          = DIRECTION.BACK;
        let DIRECTION_RIGHT         = DIRECTION.RIGHT;
        let DIRECTION_FORWARD       = DIRECTION.FORWARD;
        let DIRECTION_LEFT          = DIRECTION.LEFT;

        if(!block.material) {
            console.error('block', JSON.stringify(block), block.id);
            debugger;
        }

        let c;
        let width                   = block.material.width ? block.material.width : 1;
        let height                  = block.material.height ? block.material.height : 1;
        let drawAllSides            = width != 1 || height != 1;

        // F R B L
        switch(cardinal_direction) {
            case ROTATE.S: {
                break;
            }
            case ROTATE.W: {
                DIRECTION_BACK      = DIRECTION.LEFT;
                DIRECTION_RIGHT     = DIRECTION.BACK;
                DIRECTION_FORWARD   = DIRECTION.RIGHT;
                DIRECTION_LEFT      = DIRECTION.FORWARD;
                break;
            }
            case ROTATE.N: {
                DIRECTION_BACK      = DIRECTION.FORWARD;
                DIRECTION_RIGHT     = DIRECTION.LEFT;
                DIRECTION_FORWARD   = DIRECTION.BACK;
                DIRECTION_LEFT      = DIRECTION.RIGHT;
                break;
            }
            case ROTATE.E: {
                DIRECTION_BACK      = DIRECTION.RIGHT;
                DIRECTION_RIGHT     = DIRECTION.FORWARD;
                DIRECTION_FORWARD   = DIRECTION.LEFT;
                DIRECTION_LEFT      = DIRECTION.BACK;
                break;
            }
        }

        // Can change height
        let bH = 1.0;
        if(block.material.fluid || [BLOCK.STILL_LAVA.id, BLOCK.STILL_WATER.id].indexOf(block.id) >= 0) {
            bH = Math.min(block.power, .9)
            let blockOver  = BLOCK.getCachedBlock(chunk, x, y + 1, z);
            if(blockOver) {
                let blockOverIsFluid = (blockOver.material.fluid || [BLOCK.STILL_LAVA.id, BLOCK.STILL_WATER.id].indexOf(blockOver.id) >= 0);
                if(blockOverIsFluid) {
                    bH = 1.0;
                }
            }
            block.bH = bH;
        }

        // Убираем шапку травы с дерна, если над ним есть непрозрачный блок
        if([BLOCK.DIRT.id, BLOCK.DIRT_PATH.id, BLOCK.SNOW_DIRT.id].indexOf(block.id) >= 0) {
            if(neighbours.UP && (!neighbours.UP.material.transparent || neighbours.UP.material.is_fluid || [BLOCK.DIRT_PATH.id].indexOf(neighbours.UP.id) >= 0)) {
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

        let canDrawFace = (neighbourBlock) => {
            let resp = drawAllSides || !neighbourBlock || neighbourBlock.material.transparent;
            if(resp && neighbourBlock) {
                if(block.id == neighbourBlock.id && block.material.selflit) {
                    resp = false;
                }
            }
            return resp;
        };

        // Top
        if(canDrawFace(neighbours.UP)) {
            c = BLOCK.calcMaterialTexture(block.material, DIRECTION_UP);
            let top_vectors = [1, 0, 0, 0, 1, 0];
            // Поворот текстуры травы в случайном направлении (для избегания эффекта мозаичности поверхности)
            if(block.id == BLOCK.DIRT.id) {
                let a = new alea([x, y, z].join('x'));
                a = a.int32();
                if(a < 0) a = -a;
                let rv = a % 4;
                switch(rv) {
                    case 0: {
                        top_vectors = [0, -1, 0, 1, 0, 0];
                        break;
                    }
                    case 1: {
                        top_vectors = [-1, 0, 0, 0, -1, 0];
                        break;
                    }
                    case 2: {
                        top_vectors = [0, 1, 0, -1, 0, 0];
                        break;
                    }
                    default: {
                        break;
                    }
                }
            }
            vertices.push(x + 0.5, z + 0.5, y + bH - 1 + height,
                ...top_vectors,
                ...c,
                lm.r, lm.g, lm.b, flags | upFlags);
            if(block.material.is_fluid && block.material.transparent) {
                top_vectors = [
                    1, 0, 0,
                    0, -1, 0
                ];
                vertices.push(x + 0.5, z + 0.5, y + bH - 1 + height,
                    ...top_vectors,
                    ...c,
                    lm.r, lm.g, lm.b, flags | upFlags);
            }
        }

        // Bottom
        if(canDrawFace(neighbours.DOWN)) {
            c = BLOCK.calcMaterialTexture(block.material, DIRECTION_DOWN);
            vertices.push(x + 0.5, z + 0.5, y,
                1, 0, 0,
                0, -1, 0,
                ...c,
                lm.r, lm.g, lm.b, flags);
        }

        // South | Front/Forward
        if(canDrawFace(neighbours.SOUTH)) {
            c = BLOCK.calcMaterialTexture(block.material, DIRECTION_FORWARD);
            vertices.push(x + .5, z + .5 - width / 2, y + bH / 2,
                1, 0, 0,
                0, 0, bH,
                c[0], c[1], c[2], -c[3],
                lm.r, lm.g, lm.b, flags | sideFlags);
        }

        // North
        if(canDrawFace(neighbours.NORTH)) {
            c = BLOCK.calcMaterialTexture(block.material, DIRECTION_BACK);
            vertices.push(x + .5, z + .5 + width / 2, y + bH / 2,
                1, 0, 0,
                0, 0, -bH,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags | sideFlags);
        }

        // West
        if(canDrawFace(neighbours.WEST)) {
            c = BLOCK.calcMaterialTexture(block.material, DIRECTION_LEFT);
            vertices.push(x + .5 - width / 2, z + .5, y + bH / 2,
                0, 1, 0,
                0, 0, -bH,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags | sideFlags);
        }

        // East
        if(canDrawFace(neighbours.EAST)) {
            c = BLOCK.calcMaterialTexture(block.material, DIRECTION_RIGHT);
            vertices.push(x + .5 + width / 2, z + .5, y + bH / 2,
                0, 1, 0,
                0, 0, bH,
                c[0], c[1], c[2], -c[3],
                lm.r, lm.g, lm.b, flags | sideFlags);
        }

    }

}