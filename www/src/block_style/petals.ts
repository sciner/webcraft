import {calcRotateMatrix, DIRECTION, IndexedColor, Vector} from '../helpers.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk_const.js";
import {impl as alea} from "../../vendors/alea.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { CubeSym } from '../core/CubeSym.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';
import { BlockStyleRegInfo } from './default.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';

const {mat4} = glMatrix;

const DEFAULT_ROTATE = new Vector(0, 1, 0);
const pivotObj = {x: 0.5, y: .5, z: 0.5};

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

const _xyz = new Vector(0, 0, 0)

// Листья
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['petals'],
            this.func,
            this.computeAABB
        );
    }

    // computeAABB
    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
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
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        const material = block.material;
        const tx_cnt = material.tx_cnt;

        // if(x < 0) {
        //     x = 0
        //     y = 0
        //     z = 0
        // }

        // let random_index = Math.abs(Math.round(x * CHUNK_SIZE_Z + z) + y) % randoms.length;
        // const rnd = randoms[random_index]

        // Textures
        const c = style.block_manager.calcMaterialTexture(block.material, DIRECTION.UP, null, null, block, undefined/*, rnd*/);
        // c[0] -= .5 / tx_cnt;
        // c[1] -= .5 / tx_cnt;
        // const c_side = [...c];
        const c_up = [...c];
        // c_down[0] += 8 / tx_cnt / 32;
        // c_down[1] += 8 / tx_cnt / 32;
        // c_side[0] += 8 / tx_cnt / 32;
        // c_side[1] += 13 / tx_cnt / 32;

        // Rotate
        const rotate = block.rotate || DEFAULT_ROTATE;
        const cardinal_direction = block.getCardinalDirection();
        matrix = mat4.create();
        matrix = calcRotateMatrix(material, rotate, cardinal_direction, matrix)
        // mat4.rotate(matrix, matrix, rnd * Math.PI * 2, [0, 1, 0])

        const aabb = new AABB(0, 0, 0, 1, .1, 1).translate(x, y, z)
        _xyz.set(x, y, z)

        pushAABB(
            vertices,
            aabb,
            pivot,
            null, // matrix,
            {
                up: new AABBSideParams(c_up, 0, 1, null, null, false)
            },
            _xyz
        )

        return null

    }

}