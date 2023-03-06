import type { BLOCK } from "../../blocks.js";
import { VectorCollector2D } from "../../helpers.js";

const BLOCKS_CAN_BE_FLOOR = [468]; // DIRT_PATH

interface TemplateBlock {
    block_id : int
    move : IVector
}

export function calcMinFloorYbyXZ(bm : BLOCK, buildings_blocks : any[]) {

    const minFloorYbyXZ = new VectorCollector2D()

    for(let i = 0; i < buildings_blocks.length; i += 2) {

        const blocks: TemplateBlock[] = buildings_blocks[i + 1]

        for(const block of blocks) {
            const b = bm.fromId(block.block_id)
            // не учитываем неполные блоки у основания строения в качестве пола
            if(b.is_solid || BLOCKS_CAN_BE_FLOOR.includes(b.id)) {
                const move = block.move
                minFloorYbyXZ.update(move.x, move.z, (minY : int) => 
                    Math.min(minY ?? Infinity, move.y)
                )
            }
        }

    }

    return minFloorYbyXZ.toMatrix()

}