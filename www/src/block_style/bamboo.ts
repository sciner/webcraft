import { MAX_CHUNK_SQUARE } from "../chunk_const.js";
import {DIRECTION, FastRandom, IndexedColor, Vector} from '../helpers.js';
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import { DEFAULT_TX_CNT } from "../constant.js";
import type {BlockManager, FakeTBlock} from "../blocks.js";
import type { TBlock } from "../typed_blocks3.js";
import { BlockStyleRegInfo } from './default.js';
import type { ChunkWorkerChunk } from "../worker/chunk.js";
import type { World } from "../world.js";

const {mat4} = glMatrix;

const STALK_WIDTH = 6/32;
const TX_CNT = DEFAULT_TX_CNT;

const randoms = new FastRandom('bamboo', MAX_CHUNK_SQUARE)

const _temp_shift_pos = new Vector(0, 0, 0);

// Bamboo
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['bamboo'],
            this.func,
            this.computeAABB
        );
    }

    // computeAABB
    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : World = null, neighbours : any = null, expanded: boolean = false) : AABB[] {

        let x = 0;
        let y = 0;
        let z = 0;
        let margin = for_physic ? 0 : 1/16;

        _temp_shift_pos.copyFrom(tblock.posworld).subSelf(tblock.tb.coord);

        // Random shift
        const r = randoms.double(_temp_shift_pos.z * world.chunkManager.grid.chunkSize.x + _temp_shift_pos.x) * 4/16 - 2/16;
        x += 0.5 - 0.5 + r;
        z += 0.5 - 0.5 + r;

        const aabb = new AABB();
        aabb.set(
            x + .5 - STALK_WIDTH / 2 - margin,
            y + 0,
            z + .5 - STALK_WIDTH / 2 - margin,
            x + .5 + STALK_WIDTH / 2 + margin,
            y + 1,
            z + .5 + STALK_WIDTH / 2 + margin,
        );
        return [aabb];
    }

    // Build function
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        let stage = block?.extra_data ? block.extra_data.stage : 3;

        const bm = style.block_manager
        const no_random_pos = block.hasTag('no_random_pos');
        const into_pot = block.hasTag('into_pot');

        // Random shift
        if(!no_random_pos) {
            const r = randoms.double(z * chunk.size.x + x) * 4/16 - 2/16;
            x += 0.5 - 0.5 + r;
            z += 0.5 - 0.5 + r;
        }

        const textures = {
            stalk:          bm.calcMaterialTexture(block.material, DIRECTION.UP), // стебель
            stage0:         bm.calcMaterialTexture(block.material, DIRECTION.EAST), // первая стадия роста
            singleleaf:     bm.calcMaterialTexture(block.material, DIRECTION.WEST), // одинокий листик
            leaves:         bm.calcMaterialTexture(block.material, DIRECTION.SOUTH), // малая листва
            large_leaves:   bm.calcMaterialTexture(block.material, DIRECTION.NORTH) // широкая листва
        };

        if(into_pot) {
            stage = 4;
            y -= 6/32 - 1/500;
        }

        const pos = new Vector(x, y, z);
        const chains = [];

        switch(stage) {
            case 0: {
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: Math.PI / 4,
                    translate: [0, 0, -.5],
                    texture: textures.stage0
                });
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: -Math.PI / 4,
                    translate: [0, 0, -.5],
                    texture: textures.stage0
                });
                break;
            }
            case 1:
            case 2: {
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: 0,
                    translate: [0, 0, -.5],
                    texture: stage == 1 ? textures.leaves : textures.large_leaves
                });
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: Math.PI / 2,
                    translate: [0, 0, -.5],
                    texture: stage == 1 ? textures.leaves : textures.large_leaves
                });
                break;
            }
            case 3: {
                break;
            }
            case 4: {
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: 0,
                    translate: [0, 0, -.5],
                    texture: textures.singleleaf
                });
                break;
            }
        }

        style.pushChains(vertices, chains);

        if(stage > 0) {
            //
            matrix = mat4.create();

            const aabb = new AABB();
            aabb.set(
                x + .5 - STALK_WIDTH/2,
                y,
                z + .5 - STALK_WIDTH/2,
                x + .5 + STALK_WIDTH/2,
                y + 1,
                z + .5 + STALK_WIDTH/2
            );

            const c_up = [...textures.stalk];
            const c_side = [...textures.stalk];

            c_up[0] += (-.5 + 29/32) / TX_CNT;
            c_up[1] += (-.5 + 3/32) / TX_CNT;

            c_side[0] += (-.5 + 3/32) / TX_CNT;

            // Push vertices down
            pushAABB(
                vertices,
                aabb,
                pivot,
                matrix,
                {
                    up:     new AABBSideParams(c_up, 0, 1, null, null, true),
                    down:   new AABBSideParams(c_up, 0, 1, null, null, true),
                    south:  new AABBSideParams(c_side, 0, 1, null, null, true),
                    north:  new AABBSideParams(c_side, 0, 1, null, null, true),
                    west:   new AABBSideParams(c_side, 0, 1, null, null, true),
                    east:   new AABBSideParams(c_side, 0, 1, null, null, true),
                },
                pos
            );
        }

        return null;

    }

    //
    static pushChains(vertices, chains) {
        const _aabb_chain_middle = new AABB();
        let pivot = null;
        let matrix = null;
        for(let chain of chains) {
            _aabb_chain_middle.set(
                chain.pos.x + .5 - chain.width/2,
                chain.pos.y,
                chain.pos.z + .5 - chain.width/2,
                chain.pos.x + .5 + chain.width/2,
                chain.pos.y + chain.height,
                chain.pos.z + .5 + chain.width/2,
            );
            // Push vertices
            matrix = mat4.create();
            if(chain.rot) mat4.rotateY(matrix, matrix, chain.rot);
            if(chain.translate) mat4.translate(matrix, matrix, chain.translate);
            pushAABB(
                vertices,
                _aabb_chain_middle,
                pivot,
                matrix,
                {north: new AABBSideParams(chain.texture, 0, 1, null, null, true)},
                chain.pos
            );
        }
    }

}