import {DIRECTION, Vector} from '../helpers.js';
import {BLOCK, FakeTBlock} from "../blocks.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk_const.js";
import {impl as alea} from "../../vendors/alea.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { DEFAULT_TX_CNT } from '../constant.js';

const {mat4} = glMatrix;

const WIDTH =  6 / 16;
const HEIGHT = 6 / 16;

const WIDTH_INNER = 4/16;
const HEIGHT_INNER = 1/16;

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

// Горшок
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['pot'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {
        let aabb = new AABB();
        aabb.set(
            0 + .5 - WIDTH / 2,
            0,
            0 + .5 - WIDTH / 2,
            0 + .5 + WIDTH / 2,
            0 + HEIGHT,
            0 + .5 + WIDTH / 2,
        );
        // aabb.pad(1/32)
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        // Textures
        const c_top = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_side = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_down = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_inner_down = BLOCK.calcMaterialTexture(block.material, DIRECTION.DOWN);

        c_side[1] += 10 / 32 / DEFAULT_TX_CNT;
        c_down[1] += 10 / 32 / DEFAULT_TX_CNT;

        let aabb = new AABB();
        aabb.set(
            x + .5 - WIDTH / 2,
            y + .6,
            z + .5 - WIDTH / 2,
            x + .5 + WIDTH / 2,
            y + .6 + HEIGHT,
            z + .5 + WIDTH / 2,
        );

        matrix = mat4.create();

        // outer
        let aabb_down = new AABB();
        aabb_down.set(
            x + .5 - WIDTH/2,
            y,
            z + .5 - WIDTH/2,
            x + .5 + WIDTH/2,
            y + HEIGHT,
            z + .5 + WIDTH/2,
        );

        // Push vertices outer
        pushAABB(
            vertices,
            aabb_down,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_top, 0, 1, null, null, true), // flag: 0, anim: 1 implicit
                down:   new AABBSideParams(c_down, 0, 1, null, null, true),
                south:  new AABBSideParams(c_side, 0, 1, null, null, true),
                north:  new AABBSideParams(c_side, 0, 1, null, null, true),
                west:   new AABBSideParams(c_side, 0, 1, null, null, true),
                east:   new AABBSideParams(c_side, 0, 1, null, null, true),
            },
            new Vector(x, y, z)
        );

        // Inner
        aabb_down.set(
            x + .5 - WIDTH_INNER/2,
            y + HEIGHT - HEIGHT_INNER,
            z + .5 - WIDTH_INNER/2,
            x + .5 + WIDTH_INNER/2,
            y + HEIGHT,
            z + .5 + WIDTH_INNER/2,
        );

        // Push vertices inner
        pushAABB(
            vertices,
            aabb_down,
            pivot,
            matrix,
            {
                down:   new AABBSideParams(c_inner_down, 0, 1, null, null, true),
                south:  new AABBSideParams(c_side, 0, 1, null, null, true),
                north:  new AABBSideParams(c_side, 0, 1, null, null, true),
                west:   new AABBSideParams(c_side, 0, 1, null, null, true),
                east:   new AABBSideParams(c_side, 0, 1, null, null, true),
            },
            new Vector(x, y, z)
        );

        let flower_block_id = null;
        if(block.extra_data && block.extra_data?.item?.id) {
            flower_block_id = block.extra_data?.item.id;
        }

        if(flower_block_id) {
            const fb = new FakeTBlock(
                flower_block_id,
                null,
                new Vector(x, y + 3/16, z),
                new Vector(0, 1, 0),
                pivot,
                matrix,
                ['no_random_pos', 'into_pot'],
                biome,
                dirt_color
            );
            return [fb];
        }

        return null;

    }

}