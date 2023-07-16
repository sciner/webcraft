import { BLOCK_FLAG } from "../../constant.js";
import { AABB } from "../../core/AABB.js";
import { Vector, VectorCollector, VectorCardinalTransformer } from "../../helpers.js";
import type { ChunkWorkerChunk } from "../../worker/chunk.js";
import type { ClusterBase } from "./base.js";
import type { Building } from "./building.js";

let _depth_blocks_buffer = new Array(1)
let draw_indexes = new Array(1)

export declare type IClusterBlockDrawCallback = (chunk : ChunkWorkerChunk, x : int, y : int, z : int, block_id : int, rotate? : IVector, extra_data? : any, mat? : IBlockMaterial, check_is_solid? : boolean, destroy_fluid? : boolean) => boolean

function ensureSize(sz) {
    if (_depth_blocks_buffer.length >= sz) {
        return;
    }
    _depth_blocks_buffer = new Array(sz);
    draw_indexes = new Array(sz);
}

//
export class BlockDrawer {

    list: any[] = []
    transformer = new VectorCardinalTransformer()
    object : Building

    constructor(object? : Building) {
    }

    draw(cluster : ClusterBase, chunk : ChunkWorkerChunk, map? : any, block_set_callback? : IClusterBlockDrawCallback) {
        let blocks_setted = 0
        const _chunk_default_aabb = chunk.chunkManager.grid.chunkDefaultAABB;

        if(this.list.length == 0) {
            return blocks_setted
        }
        ensureSize(chunk.chunkManager.grid.math.CHUNK_SIZE);

        const {relativePosToFlatIndexInChunk, fromFlatChunkIndex} = chunk.chunkManager.grid.math;
        const bm            = chunk.chunkManager.block_manager
        const pos           = new Vector(0, 0, 0)
        const two2map       = new VectorCollector()
        const _pos2d        = new Vector()
        const transformer   = this.transformer
        const bm_flags      = bm.flags
        const air_id        = bm.AIR.id

        // let p = performance.now()
        let cnt = 0

        // remove blocks on one coord by his weights
        for(let j = 0; j < this.list.length; j += 2) {
            const building = this.list[j];
            const blocks = this.list[j + 1];
            building.initTransformerToChunk(transformer, chunk.coord);
            for (let i = 0; i < blocks.length; i++) {
                const item = blocks[i]
                transformer.transform(item.move, pos)
                if(_chunk_default_aabb.containsVec(pos)) {
                    const index = relativePosToFlatIndexInChunk(pos)
                    if(_depth_blocks_buffer[index]) {
                        // check weight for replace
                        const new_id = item.block_id
                        const old_id = _depth_blocks_buffer[index].block_id
                        const new_mul = !!(bm_flags[new_id] & BLOCK_FLAG.FLUID) ? 1000000 : 1
                        const old_mul = !!(bm_flags[old_id] & BLOCK_FLAG.FLUID) ? 1000000 : 1
                        if(new_id + new_mul < old_id + old_mul) {
                            continue
                        }
                    } else {
                        draw_indexes[cnt++] = index
                    }
                    _depth_blocks_buffer[index] = item
                }
            }
        }

        for(let i = 0; i < cnt; i++) {
            const index = draw_indexes[i]
            const item = _depth_blocks_buffer[index]
            _depth_blocks_buffer[index] = null
            fromFlatChunkIndex(pos, index)
            // delete block id fluid
            if(BLOCK.flags[item.block_id] & BLOCK_FLAG.FLUID) {
                if(cluster.setBlock(chunk, pos.x, pos.y, pos.z, air_id, null, null, false, false, false, map)) {
                    blocks_setted++
                }
            }
            if(cluster.setBlock(chunk, pos.x, pos.y, pos.z, item.block_id, item.rotate, item.extra_data, !!item.check_is_solid, true, !!item.candidate_for_cap_block, map, item.mat, block_set_callback)) {
                blocks_setted++
            }
            _pos2d.copyFrom(pos)
            _pos2d.y = 0
            two2map.set(_pos2d, Math.max(two2map.get(_pos2d), pos.y))
        }

        // console.log(cnt, performance.now() - p)

        // IMPORTANT: Remove grass in air over setted blocks
        const BLOCK_AIR_ID = 0
        if(two2map.size > 0) {
            for(const [pos, y] of two2map.entries()) {
                pos.y = y
                while(true) {
                    pos.y++
                    if(pos.y >= chunk.size.y) {
                        break
                    }
                    const over_block_id = cluster.getBlock(chunk, pos.x, pos.y, pos.z)
                    if(!(bm.flags[over_block_id] & BLOCK_FLAG.REMOVE_ONAIR_BLOCKS_IN_CLUSTER)) {
                        break
                    }
                    if(cluster.setBlock(chunk, pos.x, pos.y, pos.z, BLOCK_AIR_ID)) {
                        blocks_setted++
                    }
                }
            }
        }

        return blocks_setted

    }

    appendDoorBlocks(pos : Vector, block_id : int, dir : int, opened : boolean, left : boolean) {
        const list = this.list[this.list.length - 1]
        const rotate = new Vector(dir, 0, 0);
        list.push({move: pos, block_id, rotate, extra_data: {point: new Vector(0, 0, 0), opened, left, is_head: false}});
        list.push({move: pos.clone().addScalarSelf(0, 1, 0), block_id, rotate, extra_data: {point: new Vector(0, 0, 0), opened, left, is_head: true}});
    }

    append4WallsBlocks(pos : Vector, size : Vector, block_palette : any) {
        const list = this.list[this.list.length - 1]
        block_palette.reset();
        for(let y = 0; y < size.y - 1; y++) {
            for(let x = 0; x < size.x; x++) {
                for(let z = 0; z < size.z; z++) {
                    const move = new Vector(pos.x + x, pos.y + y, pos.z + z);
                    if(x < 1 || z < 1 || y < 0 || x > size.x - 2 || z > size.z - 2 || y > size.y - 1) {
                        const block_id = block_palette.next().id;
                        this.list.push({move, block_id});
                    } else {
                        list.push({move, block_id: 0});
                    }
                }
            }
        }
    }

    appendBasementBlocks(pos : Vector, size : Vector, block_id : int) {

        // floor
        const floor_pos = pos.clone().addSelf(new Vector(0, -size.y + 1, 0))
        const floor_size = size.clone();

        this.appendQuboidBlocks(floor_pos, floor_size, block_id);

    }

    appendQuboidBlocks(pos : Vector, size : Vector, block_id : int, extra_data : any = null, extend_area : int = 0) {
        const list = this.list[this.list.length - 1]
        for(let y = 0; y < size.y - 1; y++) {
            const ea = Math.floor(extend_area * (y / size.y));
            for(let x = -ea; x < size.x + ea; x++) {
                for(let z = -ea; z < size.z + ea; z++) {
                    const move = new Vector(pos.x + x, pos.y + y, pos.z + z);
                    const block = {move, block_id};
                    if(extra_data) {
                        (block as any).extra_data = extra_data;
                    }
                    list.push(block);
                }
            }
        }
    }

}