import { getChunkAddr, Vector } from "../../www/js/helpers.js";
import { ServerClient } from "../../www/js/server_client.js";
import { BLOCK } from "../../www/js/blocks.js";
import { InventoryComparator } from "../../www/js/inventory_comparator.js";
import { DEFAULT_CHEST_SLOT_COUNT, INVENTORY_DRAG_SLOT_INDEX, INVENTORY_VISIBLE_SLOT_COUNT,
    CHEST_INTERACTION_MARGIN_BLOCKS, CHEST_INTERACTION_MARGIN_BLOCKS_SERVER_ADD
} from "../../www/js/constant.js";
import { INVENTORY_CHANGE_SLOTS, INVENTORY_CHANGE_MERGE_SMALL_STACKS, 
    INVENTORY_CHANGE_CLEAR_DRAG_ITEM, INVENTORY_CHANGE_SHIFT_SPREAD } from "../../www/js/inventory.js";
import { Treasure_Sets } from "./treasure_sets.js";

const CHANGE_RESULT_FLAG_CHEST = 1;
const CHANGE_RESULT_FLAG_SECOND_CHEST = 2;
const CHANGE_RESULT_FLAG_INVENTORY = 4;

export class WorldChestManager {

    constructor(world) {
        this.world = world;
        this.treasure_sets = new Treasure_Sets(world, config.treasure_chests)
    }

    /**
     * Returns a vaild chest by pos, or throws an exception
     * @param {Vector} pos
     * @returns Chest
     */
    async get(pos) {
        const tblock = this.world.getBlock(pos);
        if(!tblock || tblock.id < 1) {
            throw `error_chest_not_found|${pos.x},${pos.y},${pos.z}`;
        }
        if(!tblock.material?.is_chest || !tblock.extra_data) {
            throw 'error_block_is_not_chest';
        }
        if(tblock.extra_data.generate) {
            const params = await this.generateChest(pos, tblock.rotate, tblock.extra_data.params);
            tblock.extra_data = params.item.extra_data;
        }
        return tblock;
    }

    /**
     * Returns a vaild chest by pos, or null
     * @param {Vector} pos
     * @returns Chest|null
     */
    async getOrNull(pos) {
        const tblock = this.world.getBlock(pos);
        if (!tblock || tblock.id < 1 ||
            !tblock.material?.is_chest || !tblock.extra_data
        ) {
            return null;
        }
        if (tblock.extra_data.generate) {
            const params = await this.generateChest(pos, tblock.rotate, tblock.extra_data.params);
            tblock.extra_data = params.item.extra_data;
        }
        return tblock;
    }

    //
    async confirmPlayerAction(player, params) {

        function combineChests(chest, secondChest) {
            if (secondChest == null) {
                return chest.slots;
            }
            var result = { ...chest.slots };
            for(var k in secondChest.slots) {
                k = parseFloat(k)
                result[k + DEFAULT_CHEST_SLOT_COUNT] = secondChest.slots[k];
            }
            return result;
        }

        var incorrectParams = false;

        // load both chests at the same time
        const pos = params.chest.pos;
        const tblockPromise = this.getOrNull(pos);
        var secondPos = null;
        var secondTblock = null;
        if (params.secondChest) {
            secondPos = params.secondChest.pos;
            secondTblock = await this.getOrNull(secondPos);
            incorrectParams |= secondTblock == null || secondTblock.material.name !== 'CHEST';
        }            
        const tblock = await tblockPromise;
        incorrectParams |= tblock == null;
        if (tblock && secondPos) {
            // We don't check if the halves match, because even if they don't, there
            // is no reason to cancel the action. We only theck that they're both
            // non-ender chests near each other.
            incorrectParams |= tblock.material.name !== 'CHEST' || 
                tblock.posworld.distanceSqr(secondPos) !== 1;
        }

        // check the distance to the chests
        const maxDist = player.game_mode.getPickatDistance() +
            CHEST_INTERACTION_MARGIN_BLOCKS + CHEST_INTERACTION_MARGIN_BLOCKS_SERVER_ADD;
        const eyePos = player.getEyePos();
        const chestCenter = new Vector(pos).addScalarSelf(0.5, 0.5, 0.5);
        const chestCenter2 = secondPos
            ? new Vector(secondPos).addScalarSelf(0.5, 0.5, 0.5)
            : null;
        incorrectParams |= eyePos.distance(chestCenter) > maxDist &&
            (!chestCenter2 || eyePos.distance(chestCenter2) > maxDist);

        if (incorrectParams) {
            player.inventory.moveOrDropFromDragSlot();
            await player.inventory.refresh(true);
            // Don't send the chests content. We expect the window to close when a block modifier comes.
            // Closing if the form also takes care of dragged item.
            throw 'error_chest_not_found';
        }
        
        const is_ender_chest = tblock.material.name == 'ENDER_CHEST';
        let chest = null;
        if(is_ender_chest) {
            chest = await player.loadEnderChest();
        } else {
            chest = tblock.extra_data;
            chest.slots = chest.slots || {};
        }

        let secondChest = null;
        if (secondPos) {
            secondChest = secondTblock.extra_data;
            secondChest.slots = secondChest.slots || {};
        }

        const chestSlotsCount = secondTblock
            ? 2 * DEFAULT_CHEST_SLOT_COUNT
            : tblock.properties.chest_slots;
        const inputChestSlotsCount = chestSlotsCount - tblock.properties.readonly_chest_slots;

        var srvCombinedChestSlots = combineChests(chest, secondChest);
        var cliCombinedChestSlots = combineChests(params.chest, params.secondChest);

        const oldSimpleInventory = InventoryComparator.groupToSimpleItems(player.inventory.items);
        const changeApplied = this.applyClientChange(srvCombinedChestSlots, cliCombinedChestSlots, 
                player.inventory.items, params.inventory_slots, params.change, player,
                inputChestSlotsCount, secondPos != null);
        const inventoryEqual = InventoryComparator.listsExactEqual(
                player.inventory.items, params.inventory_slots);

        if (changeApplied & CHANGE_RESULT_FLAG_INVENTORY) {
            // Notify the player only if the inventory change result differs from expected.
            player.inventory.refresh(!inventoryEqual);
            // Check if new quest items were added. It triggers for the dragged item too.
            const newSimpleInventory = InventoryComparator.groupToSimpleItems(player.inventory.items);
            const put_items = [];
            for(let [key, item] of newSimpleInventory) {
                if (!oldSimpleInventory.get(key)) {
                    put_items.push(item);
                }
            }
            for(let item of put_items) {
                player.onPutInventoryItems({block_id: item.id});
            }
        } else {
            // Notify the player that the inventory change failed.
            if (!inventoryEqual) {
                player.inventory.send();
            }
        }

        // Notify the player if the chest change result differs from expected.
        if (!InventoryComparator.listsExactEqual(srvCombinedChestSlots, cliCombinedChestSlots)) {
            this.sendContentToPlayers([player], pos);
            // Send both chests, even if only one differs. It's rare and doesn't matter.
            if (secondPos) {
                this.sendContentToPlayers([player], secondPos);
            }
        }
        if (changeApplied & CHANGE_RESULT_FLAG_CHEST) {
            if (secondPos) {
                // uncombine 1st chest
                chest.slots = {};
                for(var i = 0; i < DEFAULT_CHEST_SLOT_COUNT; i++) {
                    const item = srvCombinedChestSlots[i];
                    if (item) {
                        chest.slots[i] = item;
                    }
                }
            }
            // Notify the other players about the chest change
            this.sendChestToPlayers(pos, [player.session.user_id]);
            // Save to DB
            if (is_ender_chest) {
                await player.saveEnderChest(chest);
            } else {
                // Save chest slots to DB
                await this.world.db.saveChestSlots({
                    pos: pos,
                    slots: chest.slots
                });
            }
        }
        if (changeApplied & CHANGE_RESULT_FLAG_SECOND_CHEST) {
            // uncombine 2nd chest
            secondChest.slots = {};
            for(var i = 0; i < DEFAULT_CHEST_SLOT_COUNT; i++) {
                const item = srvCombinedChestSlots[i + DEFAULT_CHEST_SLOT_COUNT];
                if (item) {
                    secondChest.slots[i] = item;
                }
            }
            // Notify the other players about the chest change
            this.sendChestToPlayers(secondPos, [player.session.user_id]);
            // Save to DB
            await this.world.db.saveChestSlots({
                pos: secondPos,
                slots: secondChest.slots
            });
        }
    }

    // Validates the client change to a chest/inventory, and tries to apply on the server
    applyClientChange(srvChest, cliChest, srvInv, cliInv, change, player, inputChestSlotsCount, twoChests) {

        const that = this

        function chestResultFlag(index) {
            return twoChests && index >= DEFAULT_CHEST_SLOT_COUNT
                ? CHANGE_RESULT_FLAG_SECOND_CHEST
                : CHANGE_RESULT_FLAG_CHEST;
        }

        function resultFlag(index, isChest) {
            return isChest ? chestResultFlag(index) : CHANGE_RESULT_FLAG_INVENTORY;
        }

        function updateSlot(slot, index, inChest, delta = 0, similarSlot = null) {
            if (delta > 0) {
                if (slot == null) {
                    slot = { 
                        ...similarSlot,
                        count: 0
                    };
                    if (inChest) {
                        srvChest[index] = slot;
                    } else {
                        srvInv[index] = slot;
                    }
                }
                slot.count += delta;
            } else {
                slot.count += delta;
                if (slot.count <= 0) {
                    if (inChest) {
                        delete srvChest[index];
                    } else {
                        srvInv[index] = null;
                    }
                }
            }
        }

        function slotsEqual(a, b) {
            if (a == null || b == null) {
                return a == null && b == null;
            }
            return a.id === b.id && a.count === b.count;
        }

        // Returns the result flags
        function spreadToList(slot, isChest) {
            const list = isChest ? srvChest : srvInv;
            const slotsCount = isChest ? inputChestSlotsCount : INVENTORY_VISIBLE_SLOT_COUNT;
            const id = slot.id;
            const maxStatck = that.world.block_manager.fromId(id)?.max_in_stack;
            if (!maxStatck) {
                return 0;
            }
            var resultFlags = 0;
            if(!slot.entity_id && !slot.extra_data) {
                // add to existing input slots
                for(var i = 0; i < slotsCount; i++) {
                    const s = list[i];
                    if (s && s.id == id && s.count < maxStatck) {
                        const c = Math.min(maxStatck - s.count, slot.count);
                        s.count += c;
                        slot.count -= c;
                        resultFlags |= resultFlag(i, isChest);
                        if (slot.count == 0) {
                            return resultFlags;
                        }
                    }
                }
            }
            // move to a new slot
            for(var i = 0; i < slotsCount; i++) {
                if (list[i] == null) {
                    list[i] = { ...slot };
                    slot.count = 0;
                    return resultFlags | resultFlag(i, isChest);
                }
            }
            return resultFlags;
        }

        const srvDrag = srvInv[INVENTORY_DRAG_SLOT_INDEX];
        const cliDrag = cliInv[INVENTORY_DRAG_SLOT_INDEX];

        // The same result as in client PlayerInventory.clearDragItem()
        if (change.type === INVENTORY_CHANGE_CLEAR_DRAG_ITEM) {
            if (!srvDrag) {
                return 0;
            }
            spreadToList(srvDrag, false);
            if (srvDrag.count) {
                player.inventory.dropFromDragSlot();
            } else {
                srvInv[INVENTORY_DRAG_SLOT_INDEX] = null;
            }
            return CHANGE_RESULT_FLAG_INVENTORY;
        }

        // a result for successful changes except merging small stacks
        const defaultResult = change.slotInChest
            ? chestResultFlag(change.slotIndex) | CHANGE_RESULT_FLAG_INVENTORY
            : CHANGE_RESULT_FLAG_INVENTORY;

        var srvSlot;
        var cliSlot;
        if (change.slotInChest) {
            srvSlot = srvChest[change.slotIndex];
            cliSlot = cliChest[change.slotIndex];
        } else {
            srvSlot = srvInv[change.slotIndex];
            cliSlot = cliInv[change.slotIndex];
        }
        const prevCliSlot = change.slotPrevItem;
        const prevCliDrag = change.dragPrevItem;

        const cliSlotCount = cliSlot?.count || 0;
        const srvSlotCount = srvSlot?.count || 0;
        const cliDragCount = cliDrag?.count || 0;
        const srvDragCount = srvDrag?.count || 0;
        const prevCliSlotCount = prevCliSlot?.count || 0;
        const prevCliDragCount = prevCliDrag?.count || 0;
        const slotDelta = cliSlotCount - prevCliSlotCount;
        const dragDelta = cliDragCount - prevCliDragCount;

        if (change.type === INVENTORY_CHANGE_MERGE_SMALL_STACKS) { // Gives the same result as in base_craft_window.js: this.onDrop = function(e)
            if (!cliDrag || !prevCliDrag || cliDrag.id != prevCliDrag.id || cliDragCount <= prevCliDragCount) {
                return 0; // incorrect change
            }
            const id = cliDrag.id
            if (!srvDrag || srvDrag.id !== id) {
                return 0; // it can't be applied on server
            }
            var resultFlags = 0;
            const maxStatck = this.world.block_manager.fromId(id)?.max_in_stack;
            if (!maxStatck) {
                return 0;
            }
            var need_count = maxStatck - srvDrag.count;
            if (need_count <= 0) {
                return 0;
            }
            const list = [];
            for(var i in srvChest) {
                i = parseFloat(i);
                const item = srvChest[i];
                if (!item.entity_id && !item.extra_data &&
                    item.id === id &&
                    item.count < maxStatck
                ) {
                    list.push({chest: 1, index: i, item: item});
                }
            }
            for(let i = 0; i < INVENTORY_VISIBLE_SLOT_COUNT; ++i) {
                const item = srvInv[i];
                if (item && !item.entity_id && !item.extra_data &&
                    item.id === id &&
                    item.count < maxStatck
                ) {
                    list.push({chest: 0, index: i, item: item});
                }
            }
            list.sort(function(a, b){
                var t = a.item.count - b.item.count;
                if (t != 0) {
                    return t;
                }
                return (a.index - b.index) - 1000 * (a.chest - b.chest);
            });
            for (var v of list) {
                if (need_count == 0) {
                    break;
                }
                const item = v.item;
                let minus_count = item.count < need_count ? item.count : need_count;
                need_count -= minus_count;
                srvDrag.count += minus_count;
                item.count -= minus_count;
                if (v.chest) {
                    resultFlags |= chestResultFlag(v.index) | CHANGE_RESULT_FLAG_INVENTORY;
                    if (item.count < 1) {
                        delete srvChest[v.index];
                    }
                } else {
                    resultFlags |= CHANGE_RESULT_FLAG_INVENTORY;
                    if (item.count < 1) {
                        srvInv[v.index] = null;
                    }
                }
            }
            return resultFlags;
        }
        // The same result as in client PlayerInventory.clearDragItem()
        if (change.type === INVENTORY_CHANGE_SHIFT_SPREAD) {
            if (!prevCliSlot) {
                return 0; // incorrect change
            }
            if (!srvSlot || prevCliSlot.id != srvSlot.id) {
                return 0; // it can't be applied on server
            }
            var resultFlags = spreadToList(srvSlot, !change.slotInChest);
            if (!resultFlags) {
                return 0;
            }
            updateSlot(srvSlot, change.slotIndex, change.slotInChest);
            return resultFlags | resultFlag(change.slotIndex, change.slotInChest);
        }
        if (change.type !== INVENTORY_CHANGE_SLOTS) {
            return 0;
        }
        if (cliDrag && cliSlot && cliDrag.id !== cliSlot.id) { // swapped items
            if (!slotsEqual(prevCliSlot, cliDrag) || !slotsEqual(prevCliDrag, cliSlot) ||
                change.slotInChest && change.slotIndex >= inputChestSlotsCount
            ) {
                return 0; // incorrect change
            }
            // we can swap if the ids on the server are the same, regardless of the quantity
            if (!srvSlot || srvSlot.id !== prevCliSlot.id || 
                !srvDrag || srvDrag.id !== prevCliDrag.id
            ) {
                return 0; // it can't be applied on server
            }
            // swap
            const srvContainer = change.slotInChest ? srvChest : srvInv;
            srvContainer[change.slotIndex] = srvDrag;
            srvInv[INVENTORY_DRAG_SLOT_INDEX] = srvSlot;
            return defaultResult;
        } else if (cliDrag && prevCliSlot && slotDelta < 0) { // take from a slot
            const id = cliDrag.id
            const maxStatck = this.world.block_manager.fromId(id)?.max_in_stack;
            if (!maxStatck) {
                return 0;
            }
            if (cliSlot && cliSlot.id !== id ||
                prevCliSlot.id !== id ||
                prevCliDrag && prevCliDrag.id !== id ||
                slotDelta !== -dragDelta ||
                cliDrag.count > maxStatck
            ) {
                return 0; // incorrect change
            }
            if (!srvSlot || srvSlot.id !== id || srvDrag && srvDrag.id !== id) {
                return 0; // it can't be applied on server
            }
            const delta = Math.min(Math.min(dragDelta, maxStatck - srvDragCount), srvSlotCount);
            if (delta <= 0) {
                return 0;
            }
            // apply on the server
            updateSlot(srvDrag, INVENTORY_DRAG_SLOT_INDEX, false, delta, srvSlot);
            updateSlot(srvSlot, change.slotIndex, change.slotInChest, -delta, srvSlot);
            return defaultResult;
        } else if (prevCliDrag && cliSlot && slotDelta > 0) { // put into a slot
            const id = cliSlot.id
            const maxStatck = this.world.block_manager.fromId(id)?.max_in_stack;
            if (!maxStatck) {
                return 0;
            }
            if (prevCliSlot && prevCliSlot.id !== id ||
                cliDrag && cliDrag.id !== id ||
                prevCliDrag.id !== id ||
                slotDelta !== -dragDelta ||
                cliSlot.count > maxStatck ||
                change.slotInChest && change.slotIndex >= inputChestSlotsCount
            ) {
                return 0; // incorrect change
            }
            if (srvSlot && srvSlot.id !== id || !srvDrag || srvDrag.id !== id) {
                return 0; // it can't be applied on server
            }
            const delta = Math.min(Math.min(slotDelta, maxStatck - srvSlotCount), srvDragCount);
            if (delta <= 0) {
                return 0;
            }
            // apply on the server
            updateSlot(srvSlot, change.slotIndex, change.slotInChest, delta, srvDrag);
            updateSlot(srvDrag, INVENTORY_DRAG_SLOT_INDEX, false, -delta, srvDrag);
            return defaultResult;
        }
        return 0; // some incorrect case of INVENTORY_CHANGE_SLOTS
    }

    // Send block item
    // @todo without slots
    async sendItem(block_pos, chest) {
        const chunk_addr = getChunkAddr(block_pos);
        const chunk = this.world.chunks.get(chunk_addr);
        if(chunk) {
            const item = {
                id:         chest.id,
                extra_data: chest.extra_data,
                rotate:     chest.rotate
            };
            const packets = [{
                name: ServerClient.CMD_BLOCK_SET,
                data: {pos: block_pos, item: item}
            }];
            chunk.sendAll(packets, []);
        }
    }

    //
    async sendContentToPlayers(players, block_pos) {
        const tblock = this.world.getBlock(block_pos);
        if(!tblock || tblock.id < 0) {
            return false;
        }
        if(tblock.material.name == 'ENDER_CHEST') {
            if(players.length == 1) {
                const player = players[0];
                const c = await player.loadEnderChest();
                if(c) {
                    const chest = {
                        pos:            tblock.posworld,
                        slots:          c.slots,
                        state:          tblock.extra_data.state
                    };
                    if(chest.slots) {
                        const packets = [{
                            name: ServerClient.CMD_CHEST_CONTENT,
                            data: chest
                        }];
                        player.sendPackets(packets);
                    }
                } else {
                    console.error('error_ender_chest_empty_for_player');
                }
            }
        } else {
            if(!tblock.extra_data || !tblock.extra_data.slots) {
                return false;
            }
            const chest = {
                pos:            tblock.posworld,
                slots:          tblock.extra_data.slots,
                state:          tblock.extra_data.state
            };
            for(let player of players) {
                const packets = [{
                    name: ServerClient.CMD_CHEST_CONTENT,
                    data: chest
                }];
                player.sendPackets(packets);
            }
        }
        return true;
    }

    sendChestToPlayers(pos, except_player_ids) {
        const chunk_addr = getChunkAddr(pos);
        const chunk = this.world.chunks.get(chunk_addr);
        if(chunk) {
            const players = [];
            for(let p of Array.from(chunk.connections.values())) {
                if(except_player_ids && Array.isArray(except_player_ids)) {
                    if(except_player_ids.indexOf(p.session.user_id) >= 0) {
                        continue;
                    }
                    players.push(p);
                }
            }
            this.sendContentToPlayers(players, pos);
        }
    }

    // Generate chest
    async generateChest(pos, rotate, params) {
        const slots = this.treasure_sets.generateSlots(this.world, pos, params.source, DEFAULT_CHEST_SLOT_COUNT)
        // create db params
        const resp = {
            action_id: ServerClient.BLOCK_ACTION_CREATE,
            pos,
            item: {
                id: BLOCK.CHEST.id,
                rotate,
                extra_data: {
                    can_destroy: false,
                    slots
                }
            }
        };
        await this.world.db.blockSet(this.world, null, resp);
        return resp;

    }

}