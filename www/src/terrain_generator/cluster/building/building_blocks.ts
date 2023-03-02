import { AABB } from "../../../core/AABB.js";
import { Vector, VectorCardinalTransformer, VectorCollector } from "../../../helpers.js";
import type { ChunkWorkerChunk } from "../../../worker/chunk.js";
import type { ClusterBase } from "../base.js";
import { Building } from "../building.js";

//
export class BuildingBlocks extends Building {

    constructor(cluster: any, seed: float, coord: Vector, entrance: Vector, door_direction: int, size: Vector, building_template: any) {
        super(cluster, seed, coord, entrance, door_direction, size, building_template)
        this.chunks = new VectorCollector()
        this.transformer = new VectorCardinalTransformer()
    }

    //
    addBlocks(cluster ? : ClusterBase) {

        const dir               = this.direction
        const pos               = new Vector(0, 0, 0)
        const chunk_addr        = new Vector(0, 0, 0)
        const prev_chunk_addr   = new Vector(Infinity, Infinity, Infinity)
        const actual_aabb       = new AABB().reset()

        const blocks = this.building_template.rot[(dir + 2) % 4]

        let chunk_build_blocks: any[]
        let chunk_blocks: any[]

        const chunks = cluster ? cluster.chunks : this.chunks

        const obj = this
        obj.initToChunk(this.transformer, Vector.ZERO)

        // split all blocks by chunks
        for(let i = 0; i < blocks.length; i++) {
            const block = blocks[i]
            // pos.copyFrom(block_coord).addByCardinalDirectionSelf(item.move, dir, false, false)
            this.transformer.transform(block.move, pos)

            actual_aabb.addPoint(pos.x, pos.y, pos.z)
            actual_aabb.addPoint(pos.x + 1, pos.y + 1, pos.z + 1)
            Vector.toChunkAddr(pos, chunk_addr)
            if(!chunk_addr.equal(prev_chunk_addr)) {
                prev_chunk_addr.copyFrom(chunk_addr)
                chunk_build_blocks = chunks.get(chunk_addr)
                if(!chunk_build_blocks) {
                    chunk_build_blocks = [this, []]
                    chunks.set(chunk_addr, chunk_build_blocks)
                } else if (chunk_build_blocks[chunk_build_blocks.length - 2] !== this) {
                    chunk_build_blocks.push(this, []);
                }
                chunk_blocks = chunk_build_blocks[chunk_build_blocks.length - 1]
            }

            // if(item.move.x== -6 && item.move.y == -18 && item.move.z == 24) debugger

            chunk_blocks.push(block)
        }

        this.aabb.copyFrom(actual_aabb)
        this.size.copyFrom(actual_aabb.size)

    }

    draw(cluster : ClusterBase, chunk : ChunkWorkerChunk, map : any) {
        super.draw(cluster, chunk, this.building_template.getMeta('draw_natural_basement', true))
        // set blocks list for chunk
        this.blocks.list = this.chunks.get(chunk.addr) ?? []
        // draw chunk blocks
        this.blocks.draw(cluster, chunk, map)
    }

}