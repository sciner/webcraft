import {DIRECTION, IndexedColor, Vector} from '../helpers.js';
import {BlockManager, FakeTBlock} from "../blocks.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk_const.js";
import {impl as alea} from "../../vendors/alea.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { DEFAULT_TX_CNT } from '../constant.js';
import type { TBlock } from '../typed_blocks3.js';
import { BlockStyleRegInfo } from './default.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';


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
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['pot'],
            this.func,
            this.computeAABB
        );
    }

    // computeAABB
    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        return [new AABB(
            0 + .5 - WIDTH / 2,
            0,
            0 + .5 - WIDTH / 2,
            0 + .5 + WIDTH / 2,
            0 + HEIGHT,
            0 + .5 + WIDTH / 2,
        )]
    }

    // Build function
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        const bm = style.block_manager

        // Textures
        const c_top = bm.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_side = bm.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_down = bm.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_inner_down = bm.calcMaterialTexture(block.material, DIRECTION.DOWN);

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

        const emmited_blocks = style.emmitInpotBlock(x, y, z, block, pivot, matrix, biome, dirt_color)
        if(emmited_blocks.length > 0) {
            return emmited_blocks
        }

        return null

    }

    /**
     * @param {int} x
     * @param {int} y
     * @param {int} z
     * @param {TBlock} tblock
     * @param {*} pivot
     * @param {*} matrix
     * @param {*} biome
     * @param {IndexedColor} dirt_color
     * @returns
     */
    static emmitInpotBlock(x, y, z, tblock, pivot, matrix, biome, dirt_color) {

        let flower_block_id = null;
        if(tblock.extra_data && tblock.extra_data?.item?.id) {
            flower_block_id = tblock.extra_data?.item.id;
        }

		matrix = mat4.create()
        mat4.scale(matrix, matrix, [.3, .5, .3])
        mat4.translate(matrix, matrix, [0, -2/16, 0])
        //mat4.rotateZ(matrix, matrix, Math.PI/2)

        if(flower_block_id) {
            const fb = new FakeTBlock(
                flower_block_id,
                {
                    'into_pot': true
                },
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

        return []

    }

}