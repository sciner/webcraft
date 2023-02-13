import {IndexedColor, DIRECTION, QUAD_FLAGS, Vector} from '../helpers.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk_const.js";
import {impl as alea} from "../../vendors/alea.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import type { BlockManager } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';

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
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['bed'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(tblock : TBlock, for_physic : boolean, world : any, neighbours : any, expanded?: boolean) : AABB[] {
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

        const sz = 1024;
        const is_head = !!block.extra_data?.is_head;

        // matrix
        matrix = mat4.create();
        if(block.rotate) {
            let rot = block.rotate.x;
            mat4.rotateY(matrix, matrix, ((rot % 4) / 4) * -(2 * Math.PI));
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
        const flags = QUAD_FLAGS.FLAG_MASK_COLOR_ADD;
        const lm = new IndexedColor(block.material.mask_color.r, block.material.mask_color.g, 0, 0);
        const mask_shift = lm.b = 4; // offset for mask

        // textures
        const c_head = style.block_manager.calcMaterialTexture(block.material, DIRECTION.SOUTH);
        // IMPORTANT! c_head positions must be 0x0 coord in bed texture
        c_head[0] -= 16/sz;
        c_head[1] -= 16/sz;
        c_head[2] *= -1;
        c_head[3] *= -1;

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
            -32/sz,
            -12/sz,
        ];

        // west
        const west_axes = [ [0, 0, 1], [0, 1, 0] ];
        const c_west = [
            c_head[0] + 50/sz,
            c_head[1] + (is_head ? 28/sz : 72/sz),
            12/sz,
            32/sz,
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

        for(let leg of style.addLegs(sz, x, y, z, is_head, c_head, flags, mask_shift, lm)) {
            // push mattress vertices
            pushAABB(
                vertices,
                leg.aabb,
                pivot,
                matrix,
                leg.sides,
                new Vector(x, y, z)
            );
        }

        return null;

    }

    static addLegs(sz, x, y, z, is_head, c_head, flags, mask_shift, lm) {

        const resp = [];

        const ops = [
            {
                texY: 0 + (is_head ? 24 : 0),
                moveX: 0,
                moveZ: is_head ? 0 : (1 - LEG_WIDTH),
                index: is_head ? 0 : 2
            },
            {
                texY: 12 + (is_head ? 24 : 0),
                moveX: 1 - LEG_WIDTH,
                moveZ: is_head ? 0 : (1 - LEG_WIDTH),
                index: is_head ? 1 : 3
            }
        ];

        for(let op of ops) {
            let left_aabb = new AABB();
            left_aabb.set(x, y, z, x + LEG_WIDTH, y + LEG_HEIGHT, z + LEG_WIDTH);
            left_aabb.translate(op.moveX, 0, op.moveZ);

            const c_down    = [c_head[0] + 115/sz, c_head[1] + (op.texY + 3)/sz, 6/sz, 6/sz];
            const c_south   = [c_head[0] + 109/sz, c_head[1] + (op.texY + 9)/sz, 6/sz, 6/sz];
            const c_east    = [c_head[0] + 115/sz, c_head[1] + (op.texY + 9)/sz, 6/sz, 6/sz];
            const c_north   = [c_head[0] + 121/sz, c_head[1] + (op.texY + 9)/sz, -6/sz, -6/sz];
            const c_west    = [c_head[0] + 103/sz, c_head[1] + (op.texY + 9)/sz, -6/sz, 6/sz];

            let cc = null;
            if(op.index == 0) {
                cc = [c_south, c_east, c_north, c_west];
            } else if(op.index == 1) {
                cc = [c_west, c_south, c_east, c_north];
                cc[0][2] *= -1;
                cc[2][2] *= -1;
            } else if(op.index == 2) {
                cc = [c_east, c_north, c_west, c_south];
                cc[1][2] *= -1;
                cc[3][2] *= -1;
            } else if(op.index == 3) {
                cc = [c_north, c_west, c_south, c_east];
                cc[0][2] *= -1;
                cc[1][2] *= -1;
                cc[2][2] *= -1;
                cc[3][2] *= -1;
            } else {
                continue;
            }

            const left_sides = {
                down:   new AABBSideParams(c_down, flags, mask_shift, lm, null, false),
                south:  new AABBSideParams(cc[0], flags, mask_shift, lm, null, false),
                east:   new AABBSideParams(cc[1], flags, mask_shift, lm, null, false),
                north:  new AABBSideParams(cc[2], flags, mask_shift, lm, null, false),
                west:   new AABBSideParams(cc[3], flags, mask_shift, lm, null, false),
            };
            resp.push({aabb: left_aabb, sides: left_sides});
        }

        return resp;

    }

}