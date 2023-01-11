import { BLOCK } from "../../../blocks.js";
import { DIRECTION, Vector } from "../../../helpers.js";
import { Building } from "../building.js";

// Street light
export class StreetLight extends Building {

    static SIZE_LIST = [{size: {x: 1, z: 1}}];

    constructor(cluster, seed, coord, aabb, entrance, door_direction, size) {
        super(cluster, seed, coord, aabb, entrance, door_direction, size);
        this.draw_entrance = false;

        if(seed > .75) {
            this.blocks.list.push(...[
                {move: new Vector(0, -1, 0), block_id: BLOCK.COBBLESTONE.id},
                {move: new Vector(0, 0, 0), block_id: BLOCK.COBBLESTONE_WALL.id},
                {move: new Vector(0, 1, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 2, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 3, 0), block_id: BLOCK.COBBLESTONE_WALL.id},
                {move: new Vector(0, 4, 0), block_id: BLOCK.COBBLESTONE.id},
                {move: new Vector(0, 4, -1), block_id: BLOCK.OAK_SLAB.id, rotate: new Vector(DIRECTION.SOUTH, 0, 0)},
                {move: new Vector(0, 4, 1), block_id: BLOCK.OAK_SLAB.id, rotate: new Vector(DIRECTION.NORTH, 0, 0)},
                {move: new Vector(-1, 4, 0), block_id: BLOCK.OAK_SLAB.id, rotate: new Vector(DIRECTION.WEST, 0, 0)},
                {move: new Vector(1, 4, 0), block_id: BLOCK.OAK_SLAB.id, rotate: new Vector(DIRECTION.EAST, 0, 0)},
                {move: new Vector(0, 3, -1), block_id: BLOCK.LANTERN.id, rotate: new Vector(DIRECTION.SOUTH, -1, 0)},
                {move: new Vector(0, 3, 1), block_id: BLOCK.LANTERN.id, rotate: new Vector(DIRECTION.NORTH, -1, 0)},
                {move: new Vector(-1, 3, 0), block_id: BLOCK.LANTERN.id, rotate: new Vector(DIRECTION.WEST, -1, 0)},
                {move: new Vector(1, 3, 0), block_id: BLOCK.LANTERN.id, rotate: new Vector(DIRECTION.EAST, -1, 0)},
            ]);
        } else {
            this.blocks.list.push(...[
                {move: new Vector(0, -1, 0), block_id: BLOCK.COBBLESTONE.id},
                {move: new Vector(0, 0, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 1, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 2, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 3, 0), block_id: BLOCK.GRAY_WOOL.id},
                {move: new Vector(0, 3, -1), block_id: BLOCK.TORCH.id, rotate: new Vector(DIRECTION.SOUTH, 0, 0)},
                {move: new Vector(0, 3, 1), block_id: BLOCK.TORCH.id, rotate: new Vector(DIRECTION.NORTH, 0, 0)},
                {move: new Vector(-1, 3, 0), block_id: BLOCK.TORCH.id, rotate: new Vector(DIRECTION.WEST, 0, 0)},
                {move: new Vector(1, 3, 0), block_id: BLOCK.TORCH.id, rotate: new Vector(DIRECTION.EAST, 0, 0)},
            ]);
        }
    }

    //
    draw(cluster, chunk) {
        super.draw(cluster, chunk)
        this.blocks.draw(cluster, chunk);
    }

}