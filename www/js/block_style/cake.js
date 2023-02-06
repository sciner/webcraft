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
            styles: ['cake'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic, no_pad) {

        const pieces = block?.extra_data?.pieces || 7;
        const percent = (pieces * 4) / SIZE;

        let w = WIDTH;
        let x = 0;
        let y = 0;
        let z = 0;

        if(percent < 1) {
            w *= percent;
        }

        const aabb = new AABB();
        aabb.set(
            x + .5 - WIDTH/2,
            y,
            z + .5 - WIDTH/2,
            x + .5 - WIDTH/2 + w,
            y + HEIGHT,
            z + .5 + WIDTH/2,
        );

        if(!no_pad) {
            aabb.pad(1/500);
        }

        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        const pieces = block?.extra_data?.pieces || 7;
        const percent = (pieces * 4) / SIZE;

        const c_up = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_side = BLOCK.calcMaterialTexture(block.material, DIRECTION.FORWARD);
        const c_down = BLOCK.calcMaterialTexture(block.material, DIRECTION.DOWN);
        let c_east = c_side;

        c_side[0] += (-.5 + 16/PPB) / TX_CNT;
        c_side[1] += (-.5 + 24/PPB) / TX_CNT;

        const c_south_north = [...c_side];

        //
        matrix = mat4.create();

        if(percent < 1) {
            c_east = BLOCK.calcMaterialTexture(block.material, DIRECTION.RIGHT);
            c_east[0] += (-.5 + 16/PPB) / TX_CNT;
            c_east[1] += (-.5 + 24/PPB) / TX_CNT;
            c_up[0] -= ((1 - percent) * SIZE / PPB) / TX_CNT / 2;
            c_south_north[0] -= ((1 - percent) * SIZE / PPB) / TX_CNT / 2;
        }

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
                south:  new AABBSideParams(c_south_north, 0, 1, null, null, true),
                north:  new AABBSideParams(c_south_north, 0, 1, null, null, true),
                west:   new AABBSideParams(c_side, 0, 1, null, null, true),
                east:   new AABBSideParams(c_east, 0, 1, null, null, true),
            },
            new Vector(x, y, z)
        );

        return null;

    }

}