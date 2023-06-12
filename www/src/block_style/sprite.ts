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

        // const bm = style.block_manager

        let texture     = block.material.texture
        let height      = 1
        let width       = 0
        let lm          = IndexedColor.WHITE;
        let c           = null;
        let flags       = QUAD_FLAGS.FLAG_LOOK_AT_CAMERA

        // Texture color multiplier
        c = style.block_manager.calcTexture(texture, DIRECTION.BACK);
        let pp = IndexedColor.packLm(lm);

        pushSym(vertices, CubeSym.ID,
            x + .5, z + .5, y + .5,
            0, 0, 0,
            1, 0, 0,
            0, 0, height,
            c[0], c[1], c[2], -c[3],
            pp, flags);
        
    }
    
}