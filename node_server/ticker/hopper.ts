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
        const getItem = () => {
            for (let i = 0; i < 5; i++) {
                if (tblock.extra_data.slots[i]) {
                    const item = tblock.extra_data.slots[i]
                    delete (tblock.extra_data.slots[i])
                    updated.push({ pos: v.pos.clone(), item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY })
                    world.chests.sendChestToPlayers(tblock, null)
                    return item
                }
            }
            return null
        }
        const decItem = (i) => {
            for (let i = 0; i < 5; i++) {
                if (tblock.extra_data.slots[i]) {
                
                }
            }
        }


        /*let item = null

        for (let i = 0; i < 5; i++) {
            if (extra_data.slots[i]) {
                item = extra_data.slots[i]
                break
            }
        }

        // если есть предмет
        if (item) {
            if (neighbours.DOWN.id == bm.FURNACE.id) {
                
            }
        }

*/
        //console.log(neighbours.DOWN.id)
        if (neighbours.DOWN.id == bm.FURNACE.id) {
            if (!neighbours.DOWN.extra_data.slots[0]) {
                const item = getItem()
                if (item) {
                    neighbours.DOWN.extra_data.slots[0] = item
                    console.log(neighbours.DOWN.pos)
                    console.log(neighbours.DOWN.convertToDBItem())
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