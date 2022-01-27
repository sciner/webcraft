import {MULTIPLY, DIRECTION, QUAD_FLAGS, Color} from '../helpers.js';
import { pushPlanedGeomCorrect } from './plane.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk.js";
import {BLOCK} from "../blocks.js";
import {impl as alea} from "../../vendors/alea.js";
import { CubeSym } from '../core/CubeSym.js';
import { AABB } from '../core/AABB.js';

const aabb = new AABB();
const pivotObj = {x: 0.5, y: .5, z: 0.5};

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

// Растения
export default class style {

    static lm = new Color();

    static getRegInfo() {
        return {
            styles: ['chain'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block) {
        let cardinal_direction = block.getCardinalDirection();
        let hw = (4.5/16) / 2;
        let sign_height = 1;
        if(block.material.planting) {
            hw = 12/16 / 2;
            sign_height = 12/16;
        }
        aabb.set(
            .5-hw, 0, .5-hw,
            .5+hw, sign_height, .5+hw
        );
        aabb.applyMatrix(CubeSym.matrices[cardinal_direction], pivotObj)
        return aabb;
    }

    // getAnimations...
    static getAnimations(block, side) {
        if(!block.material.texture_animations) {
            return 1;
        }
        if(side in block.material.texture_animations) {
            return block.material.texture_animations[side];
        } else if('side' in block.material.texture_animations) {
            return block.material.texture_animations['side'];
        }
        return 1;
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome) {

        let cardinal_direction = block.getCardinalDirection()
        if(cardinal_direction == CubeSym.NEG_Y) {
            cardinal_direction = CubeSym.ROT_Y;
        }

        let dx = 0, dy = 0, dz = 0;
        let c = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP, null, null, block);
        let flags = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP;

        style.lm.set(MULTIPLY.COLOR.WHITE);
        style.lm.b = style.getAnimations(block, 'up');

        const full_tex_size = c[2];

        c[0] = c[0] - full_tex_size/2 + (full_tex_size * (3/16) / 2);
        c[2] = full_tex_size * (3/16);

        pushPlanedGeomCorrect(
            vertices,
            x, y, z, c,
            style.lm, true, false, 3/16, 1, 1, flags, 
            cardinal_direction,
            dx, dy, dz
        );

        c[0] += c[2]
        pushPlanedGeomCorrect(
            vertices,
            x, y, z, c,
            style.lm, false, false, 1, 1, 3/16, flags, 
            cardinal_direction,
            dx, dy, dz
        );

    }

}