import {DIRECTION, QUAD_FLAGS} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk.js";
import {impl as alea} from "../../vendors/alea.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;

const WIDTH             =  1;
const MATTRESS_HEIGHT   = 12/32;
const LEG_WIDTH         = 6/32;
const LEG_HEIGHT        = 6/32;
const HEIGHT            = MATTRESS_HEIGHT + LEG_HEIGHT;

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

        const sz = 1024;
        const is_head = !!block.extra_data?.is_head;

        // matrix
        matrix = mat4.create();
        if(block.rotate) {
            let rot = block.rotate.x;
            if(is_head) {
                rot += 2;
            }
            mat4.rotateY(matrix, matrix, ((rot % 4) / 4) * (2 * Math.PI));
        }
    
        // mattress
        let aabb_mattress = new AABB();
        aabb_mattress.set(
            x + .5 - WIDTH/2,
            y,
            z + .5 - WIDTH/2,
            x + .5 + WIDTH/2,
            y + MATTRESS_HEIGHT,
            z + .5 + WIDTH/2,
        ).translate(0, LEG_HEIGHT, 0);

        // flags
        const flags = QUAD_FLAGS.MASK_BIOME;
        const lm = block.material.mask_color.clone();
        const mask_shift = lm.b = 4;

        // textures
        const c_head = BLOCK.calcMaterialTexture(block.material, DIRECTION.SOUTH);
        // IMPORTANT! c_head positions must be 0x0 coord in bed texture
        c_head[0] -= 16/sz;
        c_head[1] -= 16/sz;

        // up
        const c_up = is_head ? [
            c_head[0] + 28/sz,
            c_head[1] + 28/sz,
            c_head[2],
            c_head[3],
        ] : [
            c_head[0] + 28/sz,
            c_head[1] + 72/sz,
            c_head[2],
            c_head[3],
        ];

        // down
        const c_down = [
            c_head[0] + 72/sz,
            c_head[1] + 28/sz,
            c_head[2],
            c_head[3],
        ];

        // south
        const c_south = [
            c_head[0] + 28/sz,
            c_head[1] + 6/sz,
            32/sz,
            -12/sz,
        ];

        // north
        const c_north = [
            c_head[0] + 60/sz,
            c_head[1] + 50/sz,
            32/sz,
            12/sz,
        ];
        
        // west
        const west_axes = [ [0, 0, 1], [0, 1, 0] ];
        const c_west = [
            c_head[0] + 50/sz,
            c_head[1] + (is_head ? 28/sz : 72/sz),
            -12/sz,
            -32/sz,
        ];
        
        // east
        const east_axes = [ [0, 0, -1], [0, 1, 0] ];
        const c_east = [
            c_head[0] + 6/sz,
            c_head[1] + (is_head ? 28/sz : 72/sz),
            -12/sz,
            -32/sz,
        ];

        // push mattress vertices
        pushAABB(
            vertices,
            aabb_mattress,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_up, flags, mask_shift, lm, null, true),
                down:   new AABBSideParams(c_down, 0, mask_shift, null, null, true),
                south:  new AABBSideParams(c_south, flags, mask_shift, lm, null, false),
                north:  new AABBSideParams(c_north, flags, mask_shift, lm, null, false),
                west:   new AABBSideParams(c_west, flags, mask_shift, lm, west_axes, false),
                east:   new AABBSideParams(c_east, flags, mask_shift, lm, east_axes, false),
            },
            new Vector(x, y, z)
        );

        /*for(let leg of style.addLegs(sz, x, y, z, is_head, c_head, flags, mask_shift, lm)) {
            // push mattress vertices
            pushAABB(
                vertices,
                leg.aabb,
                pivot,
                matrix,
                leg.sides,
                new Vector(x, y, z)
            );
        }*/

        return null;

    }

    static addLegs(sz, x, y, z, is_head, c_head, flags, mask_shift, lm) {

        let left_aabb = new AABB();
        left_aabb.set(
            x,
            y,
            z,
            x + LEG_WIDTH/2,
            y + LEG_HEIGHT,
            z + LEG_WIDTH/2,
        ).translate(0, LEG_HEIGHT, 0);

        const c_down = [...c_head];
        const c_south = [...c_head];
        const c_north = [...c_head];
        const c_west = [...c_head];
        const c_east = [...c_head];

        const left_sides = {
            // down:   new AABBSideParams(c_down, flags, mask_shift, lm, null, false),
            south:  new AABBSideParams(c_south, flags, mask_shift, lm, null, false),
            // north:  new AABBSideParams(c_north, flags, mask_shift, lm, null, false),
            // west:   new AABBSideParams(c_west, flags, mask_shift, lm, null, false),
            // east:   new AABBSideParams(c_east, flags, mask_shift, lm, null, false),
        };

        return [
            {aabb: left_aabb, sides: left_sides}
        ];

    }

}