import { DIRECTION, IndexedColor, QUAD_FLAGS } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';
import { BlockStyleRegInfo } from './default.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';


// Beacon/маяк
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['bn'],
            this.func,
            this.computeAABB
        );
    }
    
    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const aabb = new AABB();
        aabb.set(0, 0, 0, 1, 1, 1);
        return [aabb];
    }
    
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {
        if(typeof block == 'undefined') {
            return;
        }
        
        const bm = style.block_manager
        const texture = block.material.texture;
        const beacon = bm.calcTexture(texture, DIRECTION.UP);
        const side = bm.calcTexture(texture, DIRECTION.WEST);
        const obsidian = bm.calcTexture(texture, DIRECTION.DOWN);
  
        box(16, 16, 16, 0, vertices, side, side, x, y, z);
        box(12, 12, 2, 0, vertices, obsidian, obsidian, x, y, z);
        box(10, 10, 11, 2, vertices, beacon, beacon, x, y, z, QUAD_FLAGS.NO_CAN_TAKE_LIGHT);

        if(typeof QubatchChunkWorker != 'undefined' && block?.extra_data?.state) {
            QubatchChunkWorker.postMessage([
                (block.extra_data.state.level != 0) ? 'add_beacon_ray' : 'del_beacon_ray',
                {
                    pos: block.posworld
                }
            ]);
        }
    }
    
}

function box(width, length, height, shift, vertices, texture, texture_up, x, y, z, flags : int = 0) {
    width /= 16;
    shift /= 16;
    height /= 16;
    length /= 16;
    const lm = IndexedColor.WHITE;
    vertices.push( x + 0.5, z + 0.5 - width / 2, y + shift + height / 2, length, 0, 0, 0, 0, height, texture[0], texture[1], texture[2] * length, texture[3] * height, lm.pack(), flags);
    vertices.push( x + 0.5, z + 0.5 + width / 2, y + shift + height / 2, length, 0, 0, 0, 0, -height, texture[0], texture[1], texture[2] * length, texture[3] * height, lm.pack(), flags);
    vertices.push( x + 0.5 - length / 2, z + 0.5, y + shift + height / 2, 0, width, 0, 0, 0, -height, texture[0], texture[1], texture[2] * width, texture[3] * height, lm.pack(), flags);
    vertices.push( x + 0.5 + length / 2, z + 0.5, y + shift + height / 2, 0, width, 0, 0, 0, height, texture[0], texture[1], texture[2] * width, texture[3] * height, lm.pack(), flags);
    vertices.push( x + 0.5, z + 0.5, y + shift, length, 0, 0, 0, -width, 0, texture[0], texture[1], texture[2] * length, texture[3] * width, lm.pack(), flags);
    vertices.push( x + 0.5, z + 0.5, y + shift + height, length, 0, 0, 0, width, 0, texture_up[0], texture_up[1], texture_up[2] * length, texture_up[3] * width, lm.pack(), flags);
}