import { DIRECTION, IndexedColor, Vector } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { BlockStyleRegInfo, default as default_style } from './default.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import type { World } from '../world.js';
import type { TBlock } from 'typed_blocks3.js';

// const BLOCK_CACHE = Array.from({length: 6}, _ => new TBlock(null, new Vector(0, 0, 0)))

function getDirection(extra_data) {
    if (extra_data?.base) {
        return DIRECTION.DOWN
    } else if (extra_data?.middle) {
        return DIRECTION.SOUTH
    } else if (extra_data?.frustum) {
        return DIRECTION.NORTH
    } else if (extra_data?.merge) {
        return DIRECTION.WEST
    }
    return DIRECTION.UP
}

// style pointed_dripstone
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['pointed_dripstone'],
            this.func,
            this.computeAABB
        );
    }

    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : World = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const aabb = new AABB()
        const w2 = 22/36/2
        aabb.set(.5, 0, .5, .5, 1, .5).expand(w2, 0, w2)
        return [aabb]
    }

    // Build function
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        const bm = style.block_manager
        const extra_data = block.extra_data
        const dir = getDirection(extra_data)
        const texture = bm.calcTexture(block.material.texture, dir)
        const planes = [];
        planes.push(...[
            {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [extra_data?.up ? 0 : Math.PI, extra_data?.up ? Math.PI / 4 : Math.PI * 5 / 4, 0]},
            {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [extra_data?.up ? 0 : Math.PI, extra_data?.up ? -Math.PI / 4 : Math.PI * 3 / 4, 0]}
        ]);
        const pos = new Vector(x, y, z);
        for (const plane of planes) {
            default_style.pushPlane(vertices, {
                ...plane,
                lm:         IndexedColor.WHITE,
                pos:        pos,
                matrix:     matrix,
                flag:       0,
                texture:    [...texture]
            });
        }

        style.postBehavior(block, extra_data)

    }

    static postBehavior(tblock : TBlock | FakeTBlock, extra_data : any) {
        // анимация капель
        if (typeof QubatchChunkWorker != 'undefined' && extra_data?.up) {
            QubatchChunkWorker.postMessage(['delete_animated_block', tblock.posworld]);
        }
        if (typeof QubatchChunkWorker != 'undefined' && extra_data?.up && extra_data?.tip && (extra_data?.water || extra_data?.lava)) {
            QubatchChunkWorker.postMessage(['create_block_emitter', {
                block_pos:  tblock.posworld,
                pos:        [tblock.posworld.clone().addScalarSelf(.5, .8, .5)],
                type:       'dripping',
                isWater:    extra_data?.water
            }]);
        }
    }

}