import {DIRECTION, IndexedColor, Vector } from '../helpers.js';
import {pushSym} from '../core/CubeSym.js';
import { AABB } from '../core/AABB.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';
import { BlockStyleRegInfo } from './default.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import type { World } from '../world.js';


// Лестница
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['ladder'],
            this.func,
            style.computeAABB
        );
    }

    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : World = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const cardinal_direction = tblock.getCardinalDirection()
        const width = 3 / 15.9
        return [
            new AABB(0, 0, 0, 1, 1, width).rotate(cardinal_direction, Vector.SHAPE_PIVOT)
        ]
    }

    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        if(typeof block == 'undefined') {
            return;
        }

        const cardinal_direction = block.getCardinalDirection();

        let texture     = block.material.texture;
        let bH          = 1.0;
        let width       = block.material.width ? block.material.width : 1;
        let lm          = IndexedColor.WHITE;
        let c           = null;
        let flags       = 0;

        // Texture color multiplier
        c = style.block_manager.calcTexture(texture, DIRECTION.BACK);
        let pp = IndexedColor.packLm(lm);

        pushSym(vertices, cardinal_direction,
            x + .5, z + .5, y + .5,
            0, width - .5, bH / 2 - .5,
            1, 0, 0,
            0, 0, -bH,
            c[0], c[1], -c[2], c[3],
            pp, flags);
    }

}