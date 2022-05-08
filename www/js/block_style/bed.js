import {DIRECTION, QUAD_FLAGS} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk.js";
import {impl as alea} from "../../vendors/alea.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;

const WIDTH =  1;
const HEIGHT = .5;

const WIDTH_INNER = 4/16;
const HEIGHT_INNER = 1/16;

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

// Кровать
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['bed'],
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
        if(!for_physic) {
            aabb.pad(1 / 500);
        }
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        const is_head = !!block.extra_data?.is_head;

        // Textures
        const c_top = BLOCK.calcMaterialTexture(block.material, is_head ? DIRECTION.SOUTH : DIRECTION.NORTH);
        const c_down = BLOCK.calcMaterialTexture(block.material, DIRECTION.DOWN);
        const c_side = BLOCK.calcMaterialTexture(block.material, DIRECTION.DOWN);

        matrix = mat4.create();
        if(block.rotate) {
            let rot = block.rotate.x;
            if(is_head) {
                rot += 2;
            }
            mat4.rotateY(matrix, matrix, ((rot % 4) / 4) * (2 * Math.PI));
        }
    
        // Center
        let aabb = new AABB();
        aabb.set(
            x + .5 - WIDTH/2,
            y,
            z + .5 - WIDTH/2,
            x + .5 + WIDTH/2,
            y + HEIGHT,
            z + .5 + WIDTH/2,
        );

        const flags = QUAD_FLAGS.MASK_BIOME;
        const lm = block.material.mask_color;

        // Push vertices down
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_top, flags, 1, lm, null, true), // flag: 0, anim: 1 implicit 
                down:   new AABBSideParams(c_down, 0, 1, null, null, true),
                south:  new AABBSideParams(c_side, flags, 1, lm, null, true),
                north:  new AABBSideParams(c_side, flags, 1, lm, null, true),
                west:   new AABBSideParams(c_side, flags, 1, lm, null, true),
                east:   new AABBSideParams(c_side, flags, 1, lm, null, true),
            },
            new Vector(x, y, z)
        );

        return null;

    }

}