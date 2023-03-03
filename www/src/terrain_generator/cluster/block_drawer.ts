import { CHUNK_SIZE, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../../chunk_const.js";
import { AABB } from "../../core/AABB.js";
import { Vector, VectorCollector, VectorCardinalTransformer } from "../../helpers.js";
import type { ChunkWorkerChunk } from "../../worker/chunk.js";
import type { ClusterBase } from "./base.js";
import type { Building } from "./building.js";

const _depth_blocks = new Array(CHUNK_SIZE)
const _chunk_default_aabb = new AABB(0, 0, 0, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z)
const draw_indexes = new Array(CHUNK_SIZE)

//
export class BlockDrawer {
    [key: string]: any;

    list: any[] = []
    transformer = new VectorCardinalTransformer()
    object : Building

    constructor(object? : Building) {
    }

    draw(cluster : ClusterBase, chunk : ChunkWorkerChunk, map? : any) {

        let blocks_setted = 0

        if(this.list.length == 0) {
            return blocks_setted
        }

        const bm            = chunk.chunkManager.block_manager
        const pos           = new Vector(0, 0, 0);
        const two2map       = new VectorCollector()
        const _pos2d        = new Vector();
        const transformer   = this.transformer;

        // let p = performance.now()
        let cnt = 0

        for(let j = 0; j < this.list.length; j += 2) {
            const building = this.list[j];
            const blocks = this.list[j + 1];
            building.initTransformerToChunk(transformer, chunk.coord);
            for (let i = 0; i < blocks.length; i++) {
                const item = blocks[i]
                transformer.transform(item.move, pos)
                if(_chunk_default_aabb.contains(pos.x, pos.y, pos.z)) {
                    const index = pos.relativePosToFlatIndexInChunk()
                    if(_depth_blocks[index]) {
                        // check weight for replace
                        if(_depth_blocks[index].block_id < item.block_id) {
                            continue
                        }
                    } else {
                        draw_indexes[cnt++] = index
                    }
                    _depth_blocks[index] = item
                }
            }

        }

        for(let i = 0; i < cnt; i++) {
            const index = draw_indexes[i]
            const item = _depth_blocks[index]
            if(!item) {
                continue
            }
            _depth_blocks[index] = null
            pos.fromFlatChunkIndex(index)
            //
            if(cluster.setBlock(chunk, pos.x, pos.y, pos.z, item.block_id, item.rotate, item.extra_data, !!item.check_is_solid, true, !!item.candidate_for_cap_block, map)) {
                blocks_setted++
            }
            // if(pos.x >= 0 && pos.y >= 0 && pos.z >= 0 && pos.x < chunk.size.x && pos.y < chunk.size.y && pos.z < chunk.size.z) {
            _pos2d.copyFrom(pos)
            _pos2d.y = 0
            two2map.set(_pos2d, Math.max(two2map.get(_pos2d), pos.y))
            // }
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
                    if(!(bm.flags[over_block_id] & bm.FLAG_REMOVE_ONAIR_BLOCKS_IN_CLUSTER)) {
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

    /**
     * @param {Vector} pos 
     * @param {int} block_id 
     * @param {int} dir 
     * @param {boolean} opened 
     * @param {boolean} left 
     */
    appendDoorBlocks(pos, block_id, dir, opened, left) {
        const list = this.list[this.list.length - 1]
        const rotate = new Vector(dir, 0, 0);
        list.push({move: pos, block_id, rotate, extra_data: {point: new Vector(0, 0, 0), opened, left, is_head: false}});
        list.push({move: pos.add(new Vector(0, 1, 0)), block_id, rotate, extra_data: {point: new Vector(0, 0, 0), opened, left, is_head: true}});
    }

    /**
     * @param {Vector} pos 
     * @param {Vector} size 
     * @param {*} block_palette 
     */
    append4WallsBlocks(pos, size, block_palette) {
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

    /**
     * @param {Vector} pos 
     * @param {Vector} size 
     * @param {int} block_id 
     */
    appendBasementBlocks(pos, size, block_id) {

        // floor
        const floor_pos = pos.clone().addSelf(new Vector(0, -size.y + 1, 0))
        const floor_size = size.clone();

        this.appendQuboidBlocks(floor_pos, floor_size, block_id);

    }

    /**
     * @param {Vector} pos 
     * @param {Vector} size 
     * @param {int} block_id 
     * @param {*} extra_data 
     * @param {int} extend_area 
     */
    appendQuboidBlocks(pos, size, block_id, extra_data = null, extend_area = 0) {
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