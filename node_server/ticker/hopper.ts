import { Vector } from "@client/helpers.js";
import { ServerClient } from "@client/server_client.js";
import { TBlock } from "@client/typed_blocks3.js";
import type { TickingBlockManager } from "../server_chunk.js";

// Constants
const BLOCK_CACHE = Array.from({ length: 6 }, _ => new TBlock(null, new Vector(0, 0, 0)))

export default class Ticker {

    static type = 'hopper'

    //
    static func(this: TickingBlockManager, tick_number, world, chunk, v) {
        if ((tick_number % 8) != 0) {
            return
        }
        const bm = world.block_manager
        const tblock = v.tblock
        const neighbours = tblock.getNeighbours(world, BLOCK_CACHE)
        const cd = tblock.getCardinalDirection()
        const updated = []

        const isFullHopper = (id) => {
            for (let i = 0; i < 5; i++) {
                if (!tblock.extra_data.slots[i] || (tblock.extra_data.slots[i]?.id == id && tblock.extra_data.slots[i].count < 64)) {
                    return false
                }
            }
            return true
        }

        const updateSlot = (block, id, i) => {
            if (block?.extra_data?.slots[i]?.id == id && block.extra_data.slots[i].count < 64) {
                block.extra_data.slots[i].count++
                updated.push({ pos: block.posworld, item: block.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY })
                world.chests.sendChestToPlayers(block, null)
                return true
            }
            if (!block.extra_data.slots[i]) {
                block.extra_data.slots[i] = { id: id, count: 1 }
                updated.push({ pos: block.posworld, item: block.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY })
                world.chests.sendChestToPlayers(block, null)
                return true
            }
            return false
        }

        const updateSlots = (block, id, n) => {
            for (let i = 0; i < n; i++) {
                if (block?.extra_data?.slots[i]?.id == id && block.extra_data.slots[i].count < 64) {
                    block.extra_data.slots[i].count++
                    updated.push({ pos: block.posworld, item: block.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY })
                    world.chests.sendChestToPlayers(block, null)
                    return true
                }
            }
            for (let i = 0; i < n; i++) {
                if (!block.extra_data.slots[i]) {
                    block.extra_data.slots[i] = {id:id, count: 1}
                    updated.push({ pos: block.posworld, item: block.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY })
                    world.chests.sendChestToPlayers(block, null)
                    return true
                }
            }
            return false
        }

        const isMoveItem = (id, is_hopper = false) => {
            if (isFullHopper(id)) {
                return false
            }
            //Если что то внизу
            if (neighbours.DOWN && cd <= 3) {
                // Сундук
                if (neighbours.DOWN.id == bm.CHEST.id && updateSlots(neighbours.DOWN, id, 27)) {
                    return true
                }
                // печка
                if (neighbours.DOWN.id == bm.FURNACE.id && updateSlot(neighbours.DOWN, id, 0)) {
                    return true
                }
                // воронка
                if (neighbours.DOWN.id == bm.HOPPER.id && updateSlots(neighbours.DOWN, id, 5)) {
                    return true
                }
            }
            // если что то на западе
            if (neighbours.WEST && cd == 13) {
                // печка
                if (neighbours.WEST.id == bm.FURNACE.id && updateSlot(neighbours.WEST, id, 1)) {
                    return true
                }
                // воронка
                if (neighbours.WEST.id == bm.HOPPER.id && updateSlots(neighbours.WEST, id, 5)) {
                    return true
                }
                // Сундук
                if (neighbours.WEST.id == bm.CHEST.id && updateSlots(neighbours.WEST, id, 27)) {
                    return true
                }
            }
            // если что то на востоке
            if (neighbours.EAST && cd == 22) {
                // печка
                if (neighbours.EAST.id == bm.FURNACE.id && updateSlot(neighbours.EAST, id, 1)) {
                    return true
                }
                // воронка
                if (neighbours.EAST.id == bm.HOPPER.id && updateSlots(neighbours.EAST, id, 5)) {
                    return true
                }
                // Сундук
                if (neighbours.EAST.id == bm.CHEST.id && updateSlots(neighbours.EAST, id, 27)) {
                    return true
                }
            }
            // если что то на севере
            if (neighbours.NORTH && cd == 7) {
                // печка
                if (neighbours.NORTH.id == bm.FURNACE.id && updateSlot(neighbours.NORTH, id, 1)) {
                    return true
                }
                // воронка
                if (neighbours.NORTH.id == bm.HOPPER.id && updateSlots(neighbours.NORTH, id, 5)) {
                    return true
                }
                // Сундук
                if (neighbours.NORTH.id == bm.CHEST.id && updateSlots(neighbours.NORTH, id, 27)) {
                    return true
                }
            }
            // если что то на юге
            if (neighbours.SOUTH && cd == 18) {
                // печка
                if (neighbours.SOUTH.id == bm.FURNACE.id && updateSlot(neighbours.SOUTH, id, 1)) {
                    return true
                }
                // воронка
                if (neighbours.SOUTH.id == bm.HOPPER.id && updateSlots(neighbours.SOUTH, id, 5)) {
                    return true
                }
                // Сундук
                if (neighbours.SOUTH.id == bm.CHEST.id && updateSlots(neighbours.SOUTH, id, 27)) {
                    return true
                }
            }
            if (is_hopper) {
                return false
            }
            if (updateSlots(tblock, id, 5)) {
                return true
            }
            return false
        }

        // если в воронке есть предметы
        for (let i = 0; i < 5; i++) {
            if (tblock.extra_data.slots[i]?.id && isMoveItem(tblock.extra_data.slots[i].id, true)) {
                tblock.extra_data.slots[i].count--
                if (tblock.extra_data.slots[i].count <= 0) {
                    delete(tblock.extra_data.slots[i])
                } 
                updated.push({ pos: v.pos.clone(), item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY })
                world.chests.sendChestToPlayers(tblock, null)
                return updated
            }
        }

        // если над воронкой есть печка
        if (neighbours.UP && neighbours.UP.id == bm.FURNACE.id) {
            if (neighbours.UP?.extra_data?.slots[2]?.id && isMoveItem(neighbours.UP.extra_data.slots[2].id)) {
                neighbours.UP.extra_data.slots[2].count--
                if (neighbours.UP.extra_data.slots[2].count <= 0) {
                    delete (neighbours.UP.extra_data.slots[2])
                }
                world.chests.sendChestToPlayers(neighbours.UP, null)
                return updated
            }
        }

        // если надо воронкой сундук
        if (neighbours.UP && neighbours.UP.id == bm.CHEST.id) {
            for (let i = 0; i < 27; i++) {
                if (neighbours.UP?.extra_data?.slots[i]?.id && isMoveItem(neighbours.UP.extra_data.slots[i].id)) {
                    neighbours.UP.extra_data.slots[i].count--
                    if (neighbours.UP.extra_data.slots[i].count <= 0) {
                        delete(neighbours.UP.extra_data.slots[i])
                    }
                    world.chests.sendChestToPlayers(neighbours.UP, null)
                    return updated
                }
            }
        }

        return updated
    }

}