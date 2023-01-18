import {DIRECTION, Vector} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { DEFAULT_TX_CNT } from '../constant.js';

const {mat4} = glMatrix;

const TX_CNT    = DEFAULT_TX_CNT;
const SIZE      = 28;
const PPB       = 32; // pixels in texture per block
const WIDTH     = SIZE/PPB;
const HEIGHT    = 16/PPB;

// Azalea
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['cauldron'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic, no_pad) {
        const aabb = new AABB();
        aabb.set(
            0,
            0,
            0,
            1,
            1,
            1,
        );
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        const level = block?.extra_data?.level || 0;

        const c_up = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_side = BLOCK.calcMaterialTexture(block.material, DIRECTION.FORWARD);
        const c_down = BLOCK.calcMaterialTexture(block.material, DIRECTION.DOWN);
    
        matrix = mat4.create();

        const aabb = style.computeAABB(block, true, true)[0];
        aabb.translate(x, y, z);

        // Push vertices down
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_up, 0, 1, null, null, true),
                down:   new AABBSideParams(c_down, 0, 1, null, null, true),
                south:  new AABBSideParams(c_side, 0, 1, null, null, true),
                north:  new AABBSideParams(c_side, 0, 1, null, null, true),
                west:   new AABBSideParams(c_side, 0, 1, null, null, true),
                east:   new AABBSideParams(c_side, 0, 1, null, null, true),
            },
            new Vector(x, y, z)
        );

        return null;

    }

}