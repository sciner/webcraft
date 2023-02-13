import {calcRotateMatrix, DIRECTION, Vector} from '../helpers.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk_const.js";
import {impl as alea} from "../../vendors/alea.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { CubeSym } from '../core/CubeSym.js';
import type { BlockManager } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';

const {mat4} = glMatrix;

const DEFAULT_ROTATE = new Vector(0, 1, 0);
const pivotObj = {x: 0.5, y: .5, z: 0.5};

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

const _xyz = new Vector(0, 0, 0)

// Камушки
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['pebbles'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(tblock : TBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const aabb = new AABB().set(0, 0, 0, 1, .1, 1)
        const cardinal_direction = tblock.getCardinalDirection();
        const matrix = CubeSym.matrices[cardinal_direction]
        // on the ceil
        if(tblock.rotate && tblock.rotate.y == -1) {
            if(tblock.material.tags.includes('rotate_by_pos_n')) {
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

        if(x < 0) {
            x = 0
            y = 0
            z = 0
        }

        let random_index = Math.abs(Math.round(x * CHUNK_SIZE_Z + z) + y) % randoms.length;
        const rnd = randoms[random_index]

        // Textures
        const c = style.block_manager.calcMaterialTexture(block.material, DIRECTION.UP, null, null, block, undefined, rnd);
        c[0] -= .5 / tx_cnt;
        c[1] -= .5 / tx_cnt;
        const c_side = [...c];
        const c_down = [...c];
        c_down[0] += 8 / tx_cnt / 32;
        c_down[1] += 8 / tx_cnt / 32;
        c_side[0] += 8 / tx_cnt / 32;
        c_side[1] += 13 / tx_cnt / 32;

        // Rotate
        const rotate = block.rotate || DEFAULT_ROTATE;
        const cardinal_direction = block.getCardinalDirection();
        matrix = mat4.create();
        matrix = calcRotateMatrix(material, rotate, cardinal_direction, matrix)
        mat4.rotate(matrix, matrix, rnd * Math.PI * 2, [0, 1, 0])

        _xyz.set(x, y, z)

        for(let i = 0; i < 4; i++) {
            const w =  (2 + Math.round(rnd * i * .65)) / 16;
            const h = ((1 + Math.round(rnd * i / 2)) / 16 + 1/16 * i) / 2;
            if(h == 0) continue
            const aabb = new AABB(
                x + .5 - w/2,
                y,
                z + .5 - w/2,
                x + .5 + w/2,
                y + h,
                z + .5 + w/2
            );
            const mx = (randoms[++random_index % randoms.length] - randoms[++random_index % randoms.length]) * 6/16
            const mz = (randoms[++random_index % randoms.length] - randoms[++random_index % randoms.length]) * 6/16
            aabb.translate(mx, 0, mz)
            pushAABB(
                vertices,
                aabb,
                pivot,
                matrix,
                {
                    up:     new AABBSideParams(c_down, 0, 1, null, null, true), // flag: 0, anim: 1 implicit
                    // down:   new AABBSideParams(c_down, 0, 1, null, null, true),
                    south:  new AABBSideParams(c_side, 0, 1, null, null, true),
                    north:  new AABBSideParams(c_side, 0, 1, null, null, true),
                    west:   new AABBSideParams(c_side, 0, 1, null, null, true),
                    east:   new AABBSideParams(c_side, 0, 1, null, null, true),
                },
                _xyz
            )
        }

        return null

    }

}