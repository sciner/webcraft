import {calcRotateMatrix, DIRECTION, QUAD_FLAGS, Vector} from '../helpers.js';
import {BLOCK, DropItemVertices} from "../blocks.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk_const.js";
import {impl as alea} from "../../vendors/alea.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { CubeSym } from '../core/CubeSym.js';

const {mat4} = glMatrix;

const DEFAULT_ROTATE = new Vector(0, 1, 0);
const pivotObj = {x: 0.5, y: .5, z: 0.5};

const WIDTH =  12 / 16;
const HEIGHT = 1 / 16;

const WIDTH_INNER = 10/16;
const HEIGHT_INNER = .5/16;

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
            styles: ['item_frame'],
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

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        const material = block.material;
        const flags = QUAD_FLAGS.NORMAL_UP | QUAD_FLAGS.NO_AO;

        // Textures
        const c_up = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_side = BLOCK.calcMaterialTexture(block.material, DIRECTION.EAST);
        const c_down = BLOCK.calcMaterialTexture(block.material, DIRECTION.DOWN);
        const c_inner_down = BLOCK.calcMaterialTexture(block.material, DIRECTION.DOWN);

        c_side[1] += 10/32/32;
        c_down[1] += 10/32/32;

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

        // Rotate
        const rotate = block.rotate || DEFAULT_ROTATE;
        const cardinal_direction = block.getCardinalDirection();
        matrix = calcRotateMatrix(material, rotate, cardinal_direction, matrix);

        // outer
        const aabb_down = new AABB();
        aabb_down.set(
            x + .5 - WIDTH/2,
            y,
            z + .5 - WIDTH/2,
            x + .5 + WIDTH/2,
            y + HEIGHT,
            z + .5 + WIDTH/2,
        );

        //
        pushAABB(
            vertices,
            aabb_down,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_up, flags, 1, null, null, true), // flag: 0, anim: 1 implicit
                down:   new AABBSideParams(c_side, flags, 1, null, null, true),
                south:  new AABBSideParams(c_side, flags, 1, null, null, true),
                north:  new AABBSideParams(c_side, flags, 1, null, null, true),
                west:   new AABBSideParams(c_side, flags, 1, null, null, true),
                east:   new AABBSideParams(c_side, flags, 1, null, null, true),
            },
            new Vector(x, y, z)
        );

        // inner
        aabb_down.set(
            x + .5 - WIDTH_INNER/2,
            y + HEIGHT - HEIGHT_INNER,
            z + .5 - WIDTH_INNER/2,
            x + .5 + WIDTH_INNER/2,
            y + HEIGHT,
            z + .5 + WIDTH_INNER/2,
        );

        pushAABB(
            vertices,
            aabb_down,
            pivot,
            matrix,
            {
                down:   new AABBSideParams(c_inner_down, flags, 1, null, null, true),
                south:  new AABBSideParams(c_side, flags, 1, null, null, true),
                north:  new AABBSideParams(c_side, flags, 1, null, null, true),
                west:   new AABBSideParams(c_side, flags, 1, null, null, true),
                east:   new AABBSideParams(c_side, flags, 1, null, null, true),
            },
            new Vector(x, y, z)
        );

        // return item in frame
        if(block.extra_data && block.extra_data.item) {
            const vg = worker.drop_item_meshes[block.extra_data.item.id];

            const scale = 0.3;
            const depth = 0.3;

            const matRotate = mat4.create();
            matRotate[0] = matrix[0] * scale;
            matRotate[1] = matrix[2] * scale;
            matRotate[2] = -matrix[1] * depth;

            matRotate[4] = matrix[4] * scale;
            matRotate[5] = matrix[6] * scale;
            matRotate[6] = -matrix[5] * depth;

            matRotate[8] = matrix[8] * scale;
            matRotate[9] = matrix[10] * scale;
            matRotate[10] = -matrix[9] * depth;

            // old version compatibility
            if(!('rot' in block.extra_data)) {
                block.extra_data.rot = 0;
            }

            // old version compatibility
            if(!('rot' in block.extra_data)) {
                block.extra_data.rot = 0;
            }

            // Rotate item in frame
            const angle = Math.PI / 4 * block.extra_data.rot + Math.PI;
            const rot = [0, 0, 0];
            if(rotate.y == 0) {
                if(rotate.x == CubeSym.ROT_X) rot[2] = 1;
                if(rotate.x == 18) rot[2] = -1;
                if(rotate.x == 22) rot[0] = 1;
                if(rotate.x == 13) rot[0] = -1;
            } else {
                rot[1] = -1 * rotate.y;
            }
            mat4.rotate(matRotate, matRotate, angle, rot);
            mat4.rotate(matRotate, matRotate, Math.PI, [0, 1, 0]);
            const mesh = new DropItemVertices(block.extra_data.item.id, block.extra_data, new Vector(x, y, z), rotate, matRotate, vg.vertices);
            return [mesh];
        }

        // return empty frame
        return null;

    }

}