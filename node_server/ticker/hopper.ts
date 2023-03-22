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

        const updateSlot = (block, i, id, is_add = false) => {
            if (is_add && !block.extra_data.slots[i]) {
                block.extra_data.slots[i] = {id:id, count: 1}
                updated.push({ pos: block.posworld, item: block.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY })
                world.chests.sendChestToPlayers(block, null)
                return true
            }
            if (block?.extra_data?.slots[i]?.id == id && block.extra_data.slots[i].count < 64 && !is_add) {
                block.extra_data.slots[i].count++
                updated.push({ pos: block.posworld, item: block.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY })
                world.chests.sendChestToPlayers(block, null)
                return true
            }
            return false
        }

        const isMoveItem = (id, is_hopper = false) => {
            if (isFullHopper(id)) {
                return false
            }
            if (neighbours.DOWN && cd <= 3) {
                // Сундук
                if (neighbours.DOWN.id == bm.CHEST.id) {
                    for (let i = 0; i < 27; i++) {
                        if (updateSlot(neighbours.DOWN, i, id)) {
                            return true
                        }
                    }
                    for (let i = 0; i < 27; i++) {
                        if (updateSlot(neighbours.DOWN, i, id, true)) {
                            return true
                        }
                    }
                }
                // печка (продукция)
                if (neighbours.DOWN.id == bm.FURNACE.id) {
                    if (updateSlot(neighbours.DOWN, 0, id)) {
                        return true
                    }
                    if (updateSlot(neighbours.DOWN, 0, id, true)) {
                        return true
                    }
                }
            }
            // печка сбоку
            if (neighbours.WEST && neighbours.WEST.id == bm.FURNACE.id && cd == 13) {
                if (updateSlot(neighbours.WEST, 1, id)) {
                    return true
                }
                if (updateSlot(neighbours.WEST, 1, id, true)) {
                    return true
                }
            }
            if (neighbours.EAST && neighbours.EAST.id == bm.FURNACE.id && cd == 22) {
                if (updateSlot(neighbours.EAST, 1, id)) {
                    return true
                }
                if (updateSlot(neighbours.EAST, 1, id, true)) {
                    return true
                }
            }
            if (neighbours.NORTH && neighbours.NORTH.id == bm.FURNACE.id && cd == 7) {
                if (updateSlot(neighbours.NORTH, 1, id)) {
                    return true
                }
                if (updateSlot(neighbours.NORTH, 1, id, true)) {
                    return true
                }
            }
            if (neighbours.SOUTH && neighbours.SOUTH.id == bm.FURNACE.id && cd == 18) {
                if (updateSlot(neighbours.SOUTH, 1, id)) {
                    return true
                }
                if (updateSlot(neighbours.SOUTH, 1, id, true)) {
                    return true
                }
            }
            if (is_hopper) {
                return false
            }
            for (let i = 0; i < 5; i++) {
                if (updateSlot(tblock, i, id)) {
                    return true
                }
            }
            for (let i = 0; i < 5; i++) {
                if (updateSlot(tblock, i, id, true)) {
                    return true
                }         
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
                updated.push({ pos: neighbours.UP.posworld, item: neighbours.UP.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY })
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
                    updated.push({ pos: neighbours.UP.posworld, item: neighbours.UP.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY })
                    world.chests.sendChestToPlayers(neighbours.UP, null)
                    return updated
                }
            }
        }

        return updated
    }

}