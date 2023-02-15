import { VectorCollector2D } from "../../helpers.js";

const BLOCKS_CAN_BE_FLOOR = [468]; // DIRT_PATH

/**
 * @typedef TemplateBlock
 * @param {BLOCK} bm
 * @param {TemplateBlock[]} blocks
 * @return {ShiftedMatrix} - for each (x, z), the minimal Y of a floor block, or null
 */
export function calcMinFloorYbyXZ(bm, blocks) {
    const minFloorYbyXZ = new VectorCollector2D()

    for(const block of blocks) {
        const b = bm.fromId(block.block_id)
        // не учитываем неполные блоки у основания строения в качестве пола
        if(b.is_solid || BLOCKS_CAN_BE_FLOOR.includes(b.id)) {
            const move = block.move
            minFloorYbyXZ.update(move.x, move.z, (minY) => 
                Math.min(minY ?? Infinity, move.y)
            )
        }
    }
    return minFloorYbyXZ.toMatrix()
}