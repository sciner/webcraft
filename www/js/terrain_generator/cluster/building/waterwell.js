import { BLOCK } from "../../../blocks.js";
import { Vector } from "../../../helpers.js";
import { Building } from "../building.js";

// Water well
export class WaterWell extends Building {

    static SIZE_LIST = [{size: {x: 3, z: 3}}];

    constructor(cluster, seed, coord, entrance, door_direction, size) {

        coord.y = -14;
        size.y = 21;

        super(cluster, seed, coord, entrance, door_direction, size);
        //
        cluster.road_block.reset();
        cluster.addRoadPlatform(coord, size, cluster.road_block);

        //
        this.draw_entrance = false;

        // Blocks
        const dir = (door_direction + 2) % 4;
        const mirror_x = false; // door_direction % 2 == 1;

        if(seed < .75) {

            this.wallBlocks = this.cluster.createBlockPalette([
                {value: BLOCK.OAK_PLANKS, chance: 1}
            ]);

            this.blocks.list.push(...[
                {move: new Vector(0, 1, 1), block_id: BLOCK.COBBLESTONE_WALL.id},
                {move: new Vector(2, 1, 1), block_id: BLOCK.COBBLESTONE_WALL.id},
                {move: new Vector(0, 2, 1), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(2, 2, 1), block_id: BLOCK.OAK_FENCE.id},
                //
                {move: new Vector(0, 3, 0), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 0) % 4, 0, 0)},
                {move: new Vector(1, 3, 0), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 0) % 4, 0, 0)},
                {move: new Vector(2, 3, 0), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 1) % 4, 0, 0)},
                {move: new Vector(2, 3, 1), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 1) % 4, 0, 0)},
                {move: new Vector(2, 3, 2), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 2) % 4, 0, 0)},
                {move: new Vector(1, 3, 2), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 2) % 4, 0, 0)},
                {move: new Vector(0, 3, 2), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 3) % 4, 0, 0)},
                {move: new Vector(0, 3, 1), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 3) % 4, 0, 0)},
                //
                {move: new Vector(1, 4, 1), block_id: BLOCK.OAK_SLAB.id},
            ]);

        } else {

            this.wallBlocks = this.cluster.createBlockPalette([
                {value: BLOCK.COBBLESTONE, chance: 1}
            ]);

            this.blocks.list.push(...[
                {move: new Vector(0, 1, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 2, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(2, 1, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(2, 2, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 1, 2), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 2, 2), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(2, 1, 2), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(2, 2, 2), block_id: BLOCK.OAK_FENCE.id},
                //
                {move: new Vector(0, 3, 0), block_id: BLOCK.COBBLESTONE_SLAB.id},
                {move: new Vector(1, 3, 0), block_id: BLOCK.COBBLESTONE_SLAB.id},
                {move: new Vector(2, 3, 0), block_id: BLOCK.COBBLESTONE_SLAB.id},
                {move: new Vector(2, 3, 1), block_id: BLOCK.COBBLESTONE_SLAB.id},
                {move: new Vector(2, 3, 2), block_id: BLOCK.COBBLESTONE_SLAB.id},
                {move: new Vector(1, 3, 2), block_id: BLOCK.COBBLESTONE_SLAB.id},
                {move: new Vector(0, 3, 2), block_id: BLOCK.COBBLESTONE_SLAB.id},
                {move: new Vector(0, 3, 1), block_id: BLOCK.COBBLESTONE_SLAB.id},
                //
                {move: new Vector(1, 3, 1), block_id: BLOCK.COBBLESTONE.id},
                //
                {move: new Vector(1, 0, 0), block_id: BLOCK.COBBLESTONE_STAIRS.id, rotate: new Vector((dir + 0) % 4, 0, 0)},
                {move: new Vector(2, 0, 1), block_id: BLOCK.COBBLESTONE_STAIRS.id, rotate: new Vector((dir + 1 + (mirror_x ? 2 : 0)) % 4, 0, 0)},
                {move: new Vector(1, 0, 2), block_id: BLOCK.COBBLESTONE_STAIRS.id, rotate: new Vector((dir + 2) % 4, 0, 0)},
                {move: new Vector(0, 0, 1), block_id: BLOCK.COBBLESTONE_STAIRS.id, rotate: new Vector((dir + 3 + (mirror_x ? 2 : 0)) % 4, 0, 0)},
            ]);

        }

    }

    /**
     * 
     * @param {ClusterBase} cluster 
     * @param {*} chunk 
     */
    draw(cluster, chunk) {

        super.draw(cluster, chunk)

        cluster.drawQuboid(chunk, this.coord, this.size.add(new Vector(0, -1, 0)), BLOCK.AIR);

        // 4 walls
        const walls_size = this.size.clone().addSelf(new Vector(0, -4, 0));
        cluster.draw4Walls(chunk, this.coord, walls_size, this.wallBlocks);

        const q_pos = this.coord.add(new Vector(1, 1, 1));
        const q_size = walls_size.add(new Vector(-2, -2, -2));
        cluster.drawQuboid(chunk, q_pos, q_size, BLOCK.STILL_WATER);

        // Draw blocks
        this.blocks.draw(cluster, chunk);

    }

}