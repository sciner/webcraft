import { getChunkAddr, Vector, VectorCollector } from "../../../helpers.js";
import { Building } from "../building.js";

// 
export class BuildingBlocks extends Building {

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size, random_building) {
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size, random_building)
        this.chunks = new VectorCollector()
    }

    //
    addBlocks() {

        const blocks = this.random_building.rot[this.direction]

        const dir               = this.direction
        const pos               = new Vector(0, 0, 0)
        const block_coord       = this.pos
        const chunk_addr        = new Vector(0, 0, 0)
        const prev_chunk_addr   = new Vector(Infinity, Infinity, Infinity)

        let chunk

        // split all blocks by chunks
        for(let i = 0; i < blocks.length; i++) {
            const item = blocks[i]
            pos.copyFrom(block_coord).addByCardinalDirectionSelf(item.move, dir + 2, false, false)
            getChunkAddr(pos, chunk_addr)
            if(!chunk_addr.equal(prev_chunk_addr)) {
                prev_chunk_addr.copyFrom(chunk_addr)
                chunk = this.chunks.get(chunk_addr)
                if(!chunk) {
                    chunk = []
                    this.chunks.set(chunk_addr, chunk)
                }
            }
            chunk.push(item)
        }

    }

    /**
     * @param { import("../base.js").ClusterBase } cluster
     * @param {*} chunk 
     * @param {*} map
     */
    draw(cluster, chunk, map) {
        super.draw(cluster, chunk, this.random_building.getMeta('draw_natural_basement', true))
        // set blocks list for chunk
        this.blocks.list = this.chunks.get(chunk.addr) ?? []
        // draw chunk blocks
        if(this.blocks.list.length > 0) {
            this.blocks.draw(cluster, chunk, map)
        }
    }

}