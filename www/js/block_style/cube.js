"use strict";

import {DIRECTION, MULTIPLY, QUAD_FLAGS, ROTATE} from '../helpers.js';
import {impl as alea} from '../../vendors/alea.js';
import { BLOCK } from '../blocks.js';

// Pushes the vertices necessary for rendering a
// specific block into the array.
export function push_cube(block, vertices, world, lightmap, x, y, z, neighbours, biome) {

    if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
        return;
    }

    // Ambient occlusion
    const ao_enabled = true;
    const ao_value = .23;

    const cardinal_direction    = BLOCK.getCardinalDirection(block.rotate).z;
    let flags = 0;
    let sideFlags = 0;
    let upFlags = 0;

    // Texture color multiplier
    let lm = MULTIPLY.COLOR.WHITE;
    if(block.id == BLOCK.DIRT.id) {
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

    if(!block.name) {
        console.error('block', JSON.stringify(block), block.id);
        debugger;
    }

    let c, ao;
    let width                   = block.width ? block.width : 1;
    let height                  = block.height ? block.height : 1;
    let drawAllSides            = width != 1 || height != 1;
    let mat                     = BLOCK[block.name];
    let texture                 = mat.texture;
    let blockLit                = true;

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
    if(block.fluid || [BLOCK.STILL_LAVA.id, BLOCK.STILL_WATER.id].indexOf(block.id) >= 0) {
        bH = Math.min(block.power, .9)
        let blockOver  = world.chunkManager.getBlock(x, y + 1, z);
        if(blockOver) {
            let blockOverIsFluid = (blockOver.fluid || [BLOCK.STILL_LAVA.id, BLOCK.STILL_WATER.id].indexOf(blockOver.id) >= 0);
            if(blockOverIsFluid) {
                bH = 1.0;
            }
        }
        block.bH = bH;
    }

    // Убираем шапку травы с дерна, если над ним есть непрозрачный блок
    if([BLOCK.DIRT.id, BLOCK.DIRT_PATH.id, BLOCK.SNOW_DIRT.id].indexOf(block.id) >= 0) {
        if(neighbours.UP && (!neighbours.UP.transparent || neighbours.UP.is_fluid || [BLOCK.DIRT_PATH.id].indexOf(neighbours.UP.id) >= 0)) {
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
        let resp = drawAllSides || !neighbourBlock || neighbourBlock.transparent;
        if(resp && neighbourBlock) {
            if(block.id == neighbourBlock.id && block.selflit) {
                resp = false;
            }
        }
        return resp;
    };

    // Top
    if(canDrawFace(neighbours.UP)) {
        ao = [0, 0, 0, 0];
        if(ao_enabled) {
            let aa = this.getCachedBlock(x, y + 1, z - 1);
            let ab = this.getCachedBlock(x - 1, y + 1, z);
            let ac = this.getCachedBlock(x - 1, y + 1, z - 1);
            let ad = this.getCachedBlock(x, y + 1, z + 1);
            let ae = this.getCachedBlock(x + 1, y + 1, z);
            let af = this.getCachedBlock(x + 1, y + 1, z + 1);
            let ag = this.getCachedBlock(x - 1, y + 1, z + 1);
            let ah = this.getCachedBlock(x + 1, y + 1, z - 1);
            let aj = this.getCachedBlock(x, y + 1, z);
            if(this.visibleForAO(aa)) {ao[0] = ao_value; ao[1] = ao_value;}
            if(this.visibleForAO(ab)) {ao[0] = ao_value; ao[3] = ao_value;}
            if(this.visibleForAO(ac)) {ao[0] = ao_value; }
            if(this.visibleForAO(ad)) {ao[2] = ao_value; ao[3] = ao_value; }
            if(this.visibleForAO(ae)) {ao[1] = ao_value; ao[2] = ao_value; }
            if(this.visibleForAO(af)) {ao[2] = ao_value;}
            if(this.visibleForAO(ag)) {ao[3] = ao_value;}
            if(this.visibleForAO(ah)) {ao[1] = ao_value;}
            if(this.visibleForAO(aj)) {ao[0] = ao_value; ao[1] = ao_value; ao[2] = ao_value; ao[3] = ao_value;}
            // Если это тропинка
            if(block.id == BLOCK.DIRT_PATH.id) {
                if(neighbours.SOUTH && neighbours.SOUTH.id != BLOCK.DIRT_PATH.id) {ao[0] = ao_value; ao[1] = ao_value;}
                if(neighbours.NORTH && neighbours.NORTH.id != BLOCK.DIRT_PATH.id) {ao[2] = ao_value; ao[3] = ao_value;}
                if(neighbours.WEST && neighbours.WEST.id != BLOCK.DIRT_PATH.id) {ao[0] = ao_value; ao[3] = ao_value;}
                if(neighbours.EAST && neighbours.EAST.id != BLOCK.DIRT_PATH.id) {ao[1] = ao_value; ao[2] = ao_value;}
                let ai = this.getCachedBlock(x - 1, y, z - 1);
                let ak = this.getCachedBlock(x + 1, y, z + 1);
                let al = this.getCachedBlock(x + 1, y, z - 1);
                let am = this.getCachedBlock(x - 1, y, z + 1);
                if(this.visibleForAO(ai) && ai.id != BLOCK.DIRT_PATH.id) {ao[0] = ao_value;}
                if(this.visibleForAO(ak) && ak.id != BLOCK.DIRT_PATH.id) {ao[2] = ao_value;}
                if(this.visibleForAO(al) && al.id != BLOCK.DIRT_PATH.id) {ao[1] = ao_value;}
                if(this.visibleForAO(am) && am.id != BLOCK.DIRT_PATH.id) {ao[3] = ao_value;}
            }
        }
        c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_UP));
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
                    ao = [ao[3], ao[0], ao[1], ao[2]];
                    break;
                }
                case 1: {
                    top_vectors = [-1, 0, 0, 0, -1, 0];
                    ao = [ao[2], ao[3], ao[0], ao[1]];
                    break;
                }
                case 2: {
                    top_vectors = [0, 1, 0, -1, 0, 0];
                    ao = [ao[1], ao[2], ao[3], ao[0]];
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
            lm.r, lm.g, lm.b,
            ...ao, flags | upFlags);
        if(block.is_fluid && block.transparent) {
            top_vectors = [
                1, 0, 0,
                0, -1, 0
            ];
            vertices.push(x + 0.5, z + 0.5, y + bH - 1 + height,
                ...top_vectors,
                ...c,
                lm.r, lm.g, lm.b,
                ...ao, flags | upFlags);
        }
    }

    // Bottom
    if(canDrawFace(neighbours.DOWN)) {
        ao = [.5, .5, .5, .5];
        c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_DOWN));
        vertices.push(x + 0.5, z + 0.5, y,
            1, 0, 0,
            0, -1, 0,
            ...c,
            lm.r, lm.g, lm.b,
            ...ao, flags);
    }

    // South | Front/Forward
    if(canDrawFace(neighbours.SOUTH)) {
        ao = [0, 0, 0, 0];
        if(ao_enabled) {
            // ao[0] - левый нижний
            // ao[1] - правый нижний
            // ao[2] - правый верхний
            // ao[3] - левый верхний
            let aa = this.getCachedBlock(x - 1, y, z - 1);
            let ab = this.getCachedBlock(x + 1, y, z - 1);
            let ac = this.getCachedBlock(x, y - 1, z - 1);
            let ad = this.getCachedBlock(x + 1, y - 1, z - 1);
            let ae = this.getCachedBlock(x, y + 1, z - 1);
            let af = this.getCachedBlock(x + 1, y + 1, z - 1);
            let ag = this.getCachedBlock(x - 1, y - 1, z - 1);
            let ah = this.getCachedBlock(x - 1, y + 1, z - 1);
            let aj = this.getCachedBlock(x, y, z - 1); // to South
            if(this.visibleForAO(aa)) {ao[0] = ao_value; ao[3] = ao_value;}
            if(this.visibleForAO(ab)) {ao[1] = ao_value; ao[2] = ao_value;}
            if(this.visibleForAO(ac)) {ao[0] = ao_value; ao[1] = ao_value;}
            if(this.visibleForAO(ad)) {ao[1] = ao_value;}
            if(this.visibleForAO(ae)) {ao[2] = ao_value; ao[3] = ao_value;}
            if(this.visibleForAO(af)) {ao[2] = ao_value;}
            if(this.visibleForAO(ag)) {ao[0] = ao_value;}
            if(this.visibleForAO(ah)) {ao[3] = ao_value;}
            if(this.visibleForAO(aj)) {ao[0] = ao_value; ao[1] = ao_value; ao[2] = ao_value; ao[3] = ao_value;}
        }
        c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_FORWARD));
        vertices.push(x + .5, z + .5 - width / 2, y + bH / 2,
            1, 0, 0,
            0, 0, bH,
            c[0], c[1], c[2], -c[3],
            lm.r, lm.g, lm.b,
            ...ao, flags | sideFlags);
    }

    // North
    if(canDrawFace(neighbours.NORTH)) {
        ao = [0, 0, 0, 0];
        if(ao_enabled) {
            // ao[0] - правый верхний
            // ao[1] - левый верхний
            // ao[2] - левый нижний
            // ao[3] - правый нижний
            let aa = this.getCachedBlock(x + 1, y - 1, z + 1);
            let ab = this.getCachedBlock(x, y - 1, z + 1);
            let ac = this.getCachedBlock(x + 1, y, z + 1);
            let ad = this.getCachedBlock(x - 1, y, z + 1);
            let ae = this.getCachedBlock(x - 1, y - 1, z + 1);
            let af = this.getCachedBlock(x, y + 1, z + 1);
            let ag = this.getCachedBlock(x - 1, y + 1, z + 1);
            let ah = this.getCachedBlock(x + 1, y + 1, z + 1);
            let aj = this.getCachedBlock(x, y, z + 1); // to North
            if(this.visibleForAO(aa)) {ao[2] = ao_value;}
            if(this.visibleForAO(ab)) {ao[2] = ao_value; ao[3] = ao_value;}
            if(this.visibleForAO(ac)) {ao[1] = ao_value; ao[2] = ao_value;}
            if(this.visibleForAO(ad)) {ao[0] = ao_value; ao[3] = ao_value;}
            if(this.visibleForAO(ae)) {ao[3] = ao_value;}
            if(this.visibleForAO(af)) {ao[0] = ao_value; ao[1] = ao_value;}
            if(this.visibleForAO(ag)) {ao[0] = ao_value;}
            if(this.visibleForAO(ah)) {ao[1] = ao_value;}
            if(this.visibleForAO(aj)) {ao[0] = ao_value; ao[1] = ao_value; ao[2] = ao_value; ao[3] = ao_value;}
        }
        c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_BACK));
        vertices.push(x + .5, z + .5 + width / 2, y + bH / 2,
            1, 0, 0,
            0, 0, -bH,
            c[0], c[1], -c[2], c[3],
            lm.r, lm.g, lm.b,
            ...ao, flags | sideFlags);
    }

    // West
    if(canDrawFace(neighbours.WEST)) {
        ao = [0, 0, 0, 0];
        if(ao_enabled) {
            // ao[0] - правый верхний
            // ao[1] - левый верхний
            // ao[2] - левый нижний
            // ao[3] - правый нижний
            let aa = this.getCachedBlock(x - 1, y - 1, z - 1);
            let ab = this.getCachedBlock(x - 1, y - 1, z);
            let ac = this.getCachedBlock(x - 1, y - 1, z + 1);
            let ad = this.getCachedBlock(x - 1, y, z - 1);
            let ae = this.getCachedBlock(x - 1, y, z + 1);
            let af = this.getCachedBlock(x - 1, y + 1, z - 1);
            let ag = this.getCachedBlock(x - 1, y + 1, z);
            let ah = this.getCachedBlock(x - 1, y + 1, z + 1);
            let aj = this.getCachedBlock(x - 1, y, z); // to West
            if(this.visibleForAO(aa)) {ao[3] = ao_value;}
            if(this.visibleForAO(ab)) {ao[2] = ao_value; ao[3] = ao_value;}
            if(this.visibleForAO(ac)) {ao[2] = ao_value;}
            if(this.visibleForAO(ad)) {ao[0] = ao_value; ao[3] = ao_value;}
            if(this.visibleForAO(ae)) {ao[1] = ao_value; ao[2] = ao_value;}
            if(this.visibleForAO(af)) {ao[0] = ao_value;}
            if(this.visibleForAO(ag)) {ao[0] = ao_value; ao[1] = ao_value;}
            if(this.visibleForAO(ah)) {ao[1] = ao_value;}
            if(this.visibleForAO(aj)) {ao[0] = ao_value; ao[1] = ao_value; ao[2] = ao_value; ao[3] = ao_value;}
        }
        c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_LEFT));
        vertices.push(x + .5 - width / 2, z + .5, y + bH / 2,
            0, 1, 0,
            0, 0, -bH,
            c[0], c[1], -c[2], c[3],
            lm.r, lm.g, lm.b,
            ...ao, flags | sideFlags);
    }

    // East
    if(canDrawFace(neighbours.EAST)) {
        ao = [0, 0, 0, 0];
        if(ao_enabled) {
            // ao[0] - левый нижний
            // ao[1] - правый нижний
            // ao[2] - правый верхний
            // ao[3] - левый верхний
            let aa = this.getCachedBlock(x + 1, y, z - 1);
            let ab = this.getCachedBlock(x + 1, y, z + 1);
            let ac = this.getCachedBlock(x + 1, y - 1, z);
            let ad = this.getCachedBlock(x + 1, y - 1, z + 1);
            let ae = this.getCachedBlock(x + 1, y + 1, z + 1);
            let af = this.getCachedBlock(x + 1, y - 1, z - 1);
            let ag = this.getCachedBlock(x + 1, y + 1, z);
            let ah = this.getCachedBlock(x + 1, y + 1, z - 1);
            let aj = this.getCachedBlock(x + 1, y, z); // to East
            if(this.visibleForAO(aa)) {ao[0] = ao_value; ao[3] = ao_value;}
            if(this.visibleForAO(ab)) {ao[1] = ao_value; ao[2] = ao_value;}
            if(this.visibleForAO(ac)) {ao[0] = ao_value; ao[1] = ao_value;}
            if(this.visibleForAO(ad)) {ao[1] = ao_value;}
            if(this.visibleForAO(ae)) {ao[2] = ao_value;}
            if(this.visibleForAO(af)) {ao[0] = ao_value;}
            if(this.visibleForAO(ag)) {ao[2] = ao_value; ao[3] = ao_value;}
            if(this.visibleForAO(ah)) {ao[3] = ao_value;}
            if(this.visibleForAO(aj)) {ao[0] = ao_value; ao[1] = ao_value; ao[2] = ao_value; ao[3] = ao_value;}
        }
        c = BLOCK.calcTexture(texture(world, lightmap, blockLit, x, y, z, DIRECTION_RIGHT));
        vertices.push(x + .5 + width / 2, z + .5, y + bH / 2,
            0, 1, 0,
            0, 0, bH,
            c[0], c[1], c[2], -c[3],
            lm.r, lm.g, lm.b,
            ...ao, flags | sideFlags);
    }

}