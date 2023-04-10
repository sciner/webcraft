import { FLUID_TYPE_MASK, FLUID_WATER_ID } from '@client/fluid/FluidConst.js';
import { Vector } from '@client/helpers.js'
import { ServerClient } from '@client/server_client.js'
import type { TickingBlockManager } from "../server_chunk.js";

export default class Ticker {

    static type = 'coral'

    //
    static func(this: TickingBlockManager, tick_number, world, chunk, v) {
        if ((tick_number % 40) != 0) {
            return
        }

        const pos = v.pos.clone()
        if (!isNeighborsWater(world, pos)) {
            const bm = world.block_manager
            let id = bm.DEAD_TUBE_CORAL_BLOCK.id
            switch(v.tblock.id) {
                case bm.TUBE_CORAL_BLOCK.id: 
                    id = bm.DEAD_TUBE_CORAL_BLOCK.id 
                break
                case bm.BUBBLE_CORAL_BLOCK.id: 
                    id = bm.DEAD_BUBBLE_CORAL_BLOCK.id 
                break
                case bm.BRAIN_CORAL_BLOCK.id: 
                    id = bm.DEAD_BRAIN_CORAL_BLOCK.id 
                break
                case bm.FIRE_CORAL_BLOCK.id: 
                    id = bm.DEAD_FIRE_CORAL_BLOCK.id 
                break
                case bm.HORN_CORAL_BLOCK.id: 
                    id = bm.DEAD_HORN_CORAL_BLOCK.id 
                break
            }
            return [{pos: pos, item: {id: id}, action_id: ServerClient.BLOCK_ACTION_MODIFY}];
        }
        
    }

}

// Есть ли соседи у блока
function isNeighborsWater(world, pos) {
    const faces = [Vector.XN, Vector.XP, Vector.ZN, Vector.ZP, Vector.YP, Vector.YN]
    for (const face of faces) {
        const position = pos.add(face)
        const block = world.getBlock(position)
        if (!block || (block.id == 0 && (block.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID)) {
            return true
        }
    }
    return false
}