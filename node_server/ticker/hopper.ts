import { Vector } from "@client/helpers.js";
import {ServerClient} from "@client/server_client.js";
import { TBlock } from "@client/typed_blocks3.js";
import type { TickingBlockManager } from "../server_chunk.js";

// Constants
const BLOCK_CACHE = Array.from({length: 6}, _ => new TBlock(null, new Vector(0,0,0)))

export default class Ticker {

    static type = 'hopper'

    //
    static func(this: TickingBlockManager, tick_number, world, chunk, v) {
        if ((tick_number % 10) != 0) {
            return
        }
        const bm = world.block_manager
        const tblock = v.tblock
        const extra_data = tblock.extra_data
        const pos = v.pos.clone()
        const neighbours = tblock.getNeighbours(world, BLOCK_CACHE)
        const updated = []
        const getStackItem = () => {
            for (let i = 0; i < 5; i++) {
                if (tblock.extra_data.slots[i]) {
                    const item = tblock.extra_data.slots[i]
                    delete(tblock.extra_data.slots[i])
                    updated.push({ pos: v.pos.clone(), item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY })
                    world.chests.sendChestToPlayers(tblock, null)
                    return item
                }
            }
            return null
        }
        const decItem = (id) => {
            for (let i = 0; i < 5; i++) {
                if (tblock.extra_data.slots[i]?.id == id) {
                    tblock.extra_data.slots[i].count--
                    if (tblock.extra_data.slots[i].count <= 0) {
                        delete (tblock.extra_data.slots[i])
                    }
                    updated.push({ pos: v.pos.clone(), item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY })
                    world.chests.sendChestToPlayers(tblock, null)
                    return true
                }
            }
            return false
        }

        const getSide = () => {
            for (const side of ['WEST', 'EAST', 'NORTH', 'SOUTH']) {
                if ([bm.FURNACE.id].includes(neighbours[side]?.id)) {
                    return neighbours[side]
                }
            }
            return null
        } 

        // если под воронкой блок который производит
        if ([bm.FURNACE.id].includes(neighbours.DOWN.id)) {
            if (!neighbours.DOWN.extra_data.slots[0]) {
                const items = getStackItem()
                if (items) {
                    neighbours.DOWN.extra_data.slots[0] = items
                    updated.push({pos: neighbours.DOWN.posworld, item: neighbours.DOWN.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY})
                }
            } else {
                const item = neighbours.DOWN.extra_data.slots[0]
                if (item.count < 64 && decItem(item.id)) {
                    neighbours.DOWN.extra_data.slots[0].count++
                    updated.push({pos: neighbours.DOWN.posworld, item: neighbours.DOWN.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY})
                }
            }
        }
        


        return updated
    }

}


function getItemf(tblock, item_id) {
    for (let i = 0; i < 5; i++) {
        if (tblock.extra_data.slots[i]) {
            tblock.extra_data.slots[i].count--
            if (tblock.extra_data.slots[i].count == 0) {
                delete(tblock.extra_data.slots[i])
            }
            //console.log(tblock.extra_data.slots[i])
            break
        }
    } 
}