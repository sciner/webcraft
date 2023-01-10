import { AABB } from "../../../core/AABB.js";
import { getChunkAddr, Vector, VectorCollector } from "../../../helpers.js";
import { Building } from "../building.js";

// 
export class BuildingBlocks extends Building {

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size, building_template) {
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size, building_template)
        this.chunks = new VectorCollector()
    }

    //
    addBlocks() {

        const dir               = this.direction
        const pos               = new Vector(0, 0, 0)
        const block_coord       = this.pos
        const chunk_addr        = new Vector(0, 0, 0)
        const prev_chunk_addr   = new Vector(Infinity, Infinity, Infinity)
        const actual_aabb       = new AABB().reset()

        const blocks = this.building_template.rot[(dir + 2) % 4]

        let chunk

        // split all blocks by chunks
        for(let i = 0; i < blocks.length; i++) {
            const item = blocks[i]
            pos.copyFrom(block_coord).addByCardinalDirectionSelf(item.move, dir, false, false)
            actual_aabb.addPoint(pos.x, pos.y, pos.z)
            actual_aabb.addPoint(pos.x + 1, pos.y + 1, pos.z + 1)
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

        this.aabb.copyFrom(actual_aabb)
        this.size.set(actual_aabb.width, actual_aabb.height, actual_aabb.depth);

    }

    /**
     * @param { import("../base.js").ClusterBase } cluster
     * @param {*} chunk 
     * @param {*} map
     */
    draw(cluster, chunk, map) {
        super.draw(cluster, chunk, this.building_template.getMeta('draw_natural_basement', true))
        // set blocks list for chunk
        this.blocks.list = this.chunks.get(chunk.addr) ?? []
        // draw chunk blocks
        if(this.blocks.list.length > 0) {
            this.blocks.draw(cluster, chunk, map)
        }
    }

}