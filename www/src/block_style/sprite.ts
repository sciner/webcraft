// import {DIRECTION, IndexedColor, Vector} from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { BlockStyleRegInfo } from './default.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import type { World } from '../world.js';
import { DIRECTION, IndexedColor, QUAD_FLAGS } from '../helpers.js';
import {CubeSym, pushSym} from '../core/CubeSym.js';

// гнездо для кур
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['sprite'],
            this.func,
            this.computeAABB
        );
    }
    
    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : World = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const aabb = new AABB()
        aabb.set(0, 0, 0, 1, 1, 1)
        return [aabb]
    }
    
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        const texture   = block.material.texture
        const c         = style.block_manager.calcTexture(texture, DIRECTION.BACK)
        const flags     = QUAD_FLAGS.FLAG_LOOK_AT_CAMERA | QUAD_FLAGS.FLAG_NORMAL_UP | QUAD_FLAGS.FLAG_NO_AO
        const pp        = 0

        pushSym(vertices, CubeSym.ID,
            x + .5, z + .5, y + .5,
            0, 0, 0,
            1, 0, 0,
            0, 0, 1,
            c[0], c[1], c[2], -c[3],
            pp, flags)

    }
    
}