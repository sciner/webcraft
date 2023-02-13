import {calcRotateMatrix, DIRECTION, Vector} from '../helpers.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk_const.js";
import {impl as alea} from "../../vendors/alea.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { CubeSym } from '../core/CubeSym.js';
import type { BlockManager } from '../blocks.js';

const {mat4} = glMatrix;

const DEFAULT_ROTATE = new Vector(0, 1, 0);
const pivotObj = {x: 0.5, y: .5, z: 0.5};

const WIDTH =  4 / 16;
const HEIGHT = 1 / 16;

const WIDTH_STICK = 2/16;
const HEIGHT_STICK = 15/16;

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

// Горшок
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['end_rod'],
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
            0 + 1,
            0 + .5 + WIDTH / 2,
        );
        //
        const cardinal_direction = block.getCardinalDirection();
        const matrix = CubeSym.matrices[cardinal_direction];
        // on the ceil
        if(block.rotate && block.rotate.y == -1) {
            if(block.material.tags.includes('rotate_by_pos_n')) {
                aabb.translate(0, 1 - aabb.y_max, 0)
            }
        }
        aabb.applyMatrix(matrix, pivotObj);
        //
        if(!for_physic) {
            aabb.pad(1/500);
        }
        // aabb.pad(1/32)
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        const material = block.material;
        const tx_cnt = material.tx_cnt;

        // Textures
        const c = style.block_manager.calcMaterialTexture(block.material, DIRECTION.UP);
        c[0] -= .5 / tx_cnt;
        c[1] -= .5 / tx_cnt;

        matrix = mat4.create();

        // Rotate
        const rotate = block.rotate || DEFAULT_ROTATE;
        const cardinal_direction = block.getCardinalDirection();
        matrix = calcRotateMatrix(material, rotate, cardinal_direction, matrix);

        // AABB
        const aabb_down = new AABB();

        // down
        aabb_down.set(
            x + .5 - WIDTH/2,
            y,
            z + .5 - WIDTH/2,
            x + .5 + WIDTH/2,
            y + HEIGHT,
            z + .5 + WIDTH/2,
        );
        let c_side = [...c];
        let c_down = [...c];
        c_down[0] += 8 / tx_cnt / 32;
        c_down[1] += 8 / tx_cnt / 32;
        c_side[0] += 8 / tx_cnt / 32;
        c_side[1] += 13 / tx_cnt / 32;
        pushAABB(
            vertices,
            aabb_down,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_down, 0, 1, null, null, true), // flag: 0, anim: 1 implicit
                down:   new AABBSideParams(c_down, 0, 1, null, null, true),
                south:  new AABBSideParams(c_side, 0, 1, null, null, true),
                north:  new AABBSideParams(c_side, 0, 1, null, null, true),
                west:   new AABBSideParams(c_side, 0, 1, null, null, true),
                east:   new AABBSideParams(c_side, 0, 1, null, null, true),
            },
            new Vector(x, y, z)
        );

        // inner

        // down
        aabb_down.set(
            x + .5 - WIDTH_STICK/2,
            y,
            z + .5 - WIDTH_STICK/2,
            x + .5 + WIDTH_STICK/2,
            y + HEIGHT_STICK,
            z + .5 + WIDTH_STICK/2,
        );
        aabb_down.translate(0, 2/32, 0);
        c_side = [...c];
        c_down = [...c];
        c_down[0] += 6 / tx_cnt / 32;
        c_down[1] += 2 / tx_cnt / 32;
        c_side[0] += 2 / tx_cnt / 32;
        c_side[1] += 15 / tx_cnt / 32;
        pushAABB(
            vertices,
            aabb_down,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_down, 0, 1, null, null, true), // flag: 0, anim: 1 implicit
                down:   new AABBSideParams(c_down, 0, 1, null, null, true),
                south:  new AABBSideParams(c_side, 0, 1, null, null, true),
                north:  new AABBSideParams(c_side, 0, 1, null, null, true),
                west:   new AABBSideParams(c_side, 0, 1, null, null, true),
                east:   new AABBSideParams(c_side, 0, 1, null, null, true),
            },
            new Vector(x, y, z)
        );

        // return empty frame
        return null;

    }

}