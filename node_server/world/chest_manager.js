import { getChunkAddr, Vector } from "../../www/js/helpers.js";
import { ServerClient } from "../../www/js/server_client.js";
import { BLOCK } from "../../www/js/blocks.js";
import { alea } from "../../www/js/terrain_generator/default.js";
import { InventoryComparator } from "../../www/js/inventory_comparator.js";
import { DEFAULT_CHEST_SLOT_COUNT, INVENTORY_DRAG_SLOT_INDEX } from "../../www/js/constant.js";

const CHANGE_RESULT_FLAG_CHEST = 1;
const CHANGE_RESULT_FLAG_INVENTORY = 2;

export class WorldChestManager {

    constructor(world) {
        this.world = world;
    }

    /**
     * Return chest by pos
     * @param {Vector} pos
     * @returns Chest|null
     */
    async get(pos) {
        const tblock = this.world.getBlock(pos);
        if(!tblock || tblock.id < 1) {
            throw `error_chest_not_found|${pos.x},${pos.y},${pos.z}`;
        }
        if(!tblock.material?.is_chest || !tblock.extra_data) {
            throw 'error_block_is_not_chest';
        }
        if(tblock.extra_data?.generate) {
            const params = await this.generateChest(pos, tblock.rotate, tblock.extra_data.params);
            tblock.extra_data = params.item.extra_data;
        }
        return tblock;
    }

    //
    async confirmPlayerAction(player, pos, params) {

        // Compares the server state and the new state from the player
        async function serverAndClientEqual() {
            const old_items = [...player.inventory.items, ...Array.from(Object.values(chest.slots))];
            const new_items = [...params.inventory_slots, ...Array.from(Object.values(new_chest_slots))];
            return await InventoryComparator.checkEqual(old_items, new_items, []);
        }

        const tblock_chest = await this.get(pos);
        const is_ender_chest = tblock_chest.material.name == 'ENDER_CHEST';

        let chest = null;

        if(is_ender_chest) {
            chest = await player.loadEnderChest();
        } else {
            chest = tblock_chest.extra_data;
            if(!('slots' in chest)) {
                chest.slots = {};
            }
        }

        // Валидация ключей слотов сундука,
        // а также самих айтемов путем их привидения к строгому формату.
        // Вдруг нам клиент прислал хрень
        const new_chest_slots = {};
        for(let k in params.chest.slots) {
            if(!isNaN(k) && k >= 0 && k < DEFAULT_CHEST_SLOT_COUNT) {
                let item = params.chest.slots[k];
                new_chest_slots[k] = BLOCK.convertItemToInventoryItem(item);
            }
        }

        // if the player was editing chest/inventory using chest UI
        if (params.change) {
            const changeApplied = this.applyClientChange(chest.slots, new_chest_slots, 
                    player.inventory.items, params.inventory_slots, params.change);
            if (changeApplied & CHANGE_RESULT_FLAG_INVENTORY) {
                const equal = await serverAndClientEqual();
                // Save the invenory to DB.
                // Notify the player if the result differs from expected.
                // Send the inventory to other players.
                player.inventory.refresh(!equal);
            } else {
                // Notify the player if inventory the change failed
                player.inventory.send();
            }
            // Notify the other players about the chest change
            if ((changeApplied & CHANGE_RESULT_FLAG_CHEST) && !is_ender_chest) {
                this.sendChestToPlayers(pos, [player.session.user_id]);
            }
            return;
        }

        const equal = await serverAndClientEqual();

        //
        if(equal) {
            // учёт появления новых элементов в инвентаре (для квестов)
            if(player.onPutInventoryItems) {
                const old_simple = InventoryComparator.groupToSimpleItems(player.inventory.items);
                const new_simple = InventoryComparator.groupToSimpleItems(params.inventory_slots);
                const put_items = [];
                for(let [key, item] of new_simple) {
                    const old_item = old_simple.get(key);
                    if(!old_item) {
                        put_items.push(item);
                    }
                }
                for(let item of put_items) {
                    player.onPutInventoryItems({block_id: item.id});
                }
            }
            // update chest slots
            chest.slots = new_chest_slots;
            // update player inventory
            player.inventory.applyNewItems(params.inventory_slots, false);
            player.inventory.refresh(false);
            if(is_ender_chest) {
                await player.saveEnderChest(chest);
                // Send new chest state to players
                this.sendChestToPlayers(pos, [player.session.user_id]);
            } else {
                // Send new chest state to players
                this.sendChestToPlayers(pos, [player.session.user_id]);
                // Save chest slots to DB
                await this.world.db.saveChestSlots({
                    pos: pos,
                    slots: chest.slots
                });
                //
                this.sendItem(pos, tblock_chest);
            }
        } else {
            if(!is_ender_chest) {
                this.sendContentToPlayers([player], pos);
            }
            // @todo
            player.inventory.refresh(true);
        }
    }

    // Validates the client change to a chest/inventory, and tries to apply on the server
    applyClientChange(srvChest, cliChest, srvInv, cliInv, change) {

        function updateSlot(slot, index, inChest, delta, similarSlot) {
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

        // a result for successful changes except merging small stacks
        const defaultResult = change.slotInChest
            ? CHANGE_RESULT_FLAG_CHEST | CHANGE_RESULT_FLAG_INVENTORY
            : CHANGE_RESULT_FLAG_INVENTORY;

        const srvDrag = srvInv[INVENTORY_DRAG_SLOT_INDEX];
        const cliDrag = cliInv[INVENTORY_DRAG_SLOT_INDEX];
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
        const prevCliDrag = change.dargPrevItem;

        const cliSlotCount = cliSlot?.count || 0;
        const srvSlotCount = srvSlot?.count || 0;
        const cliDragCount = cliDrag?.count || 0;
        const srvDragCount = srvDrag?.count || 0;
        const prevCliSlotCount = prevCliSlot?.count || 0;
        const prevCliDragCount = prevCliDrag?.count || 0;
        const slotDelta = cliSlotCount - prevCliSlotCount;
        const dragDelta = cliDragCount - prevCliDragCount;

        if (change.mergeSmallStacks) { // Gives the same result as in base_craft_window.js: this.onDrop = function(e)
            if (!cliDrag || !prevCliDrag || cliDrag.id != prevCliDrag.id || cliDragCount <= prevCliDragCount) {
                return 0; // incorrect change
            }
            const id = cliDrag.id
            if (!srvDrag || srvDrag.id !== id) {
                return 0; // it can't be applied on server
            }
            var resultFlags = 0;
            const maxStatck = this.world.block_manager.fromId(id)?.max_in_stack;
            let need_count = maxStatck - srvDrag.count;
            for(let i in srvChest) {
                if (need_count == 0) {
                    break;
                }
                const item = srvChest[i];
                if (!item.entity_id && !item.extra_data &&
                    item.id === id &&
                    item.count < maxStatck
                ) {
                    let minus_count = item.count < need_count ? item.count : need_count;
                    need_count -= minus_count;
                    srvDrag.count += minus_count;
                    item.count -= minus_count;
                    if (item.count < 1) {
                        delete srvChest[i];
                    }
                    resultFlags |= (CHANGE_RESULT_FLAG_CHEST | CHANGE_RESULT_FLAG_INVENTORY);
                }
            }
            for(let i = 0; i < INVENTORY_DRAG_SLOT_INDEX; ++i) {
                if (need_count == 0) {
                    break;
                }
                const item = srvInv[i];
                if (item && !item.entity_id && !item.extra_data &&
                    item.id === id &&
                    item.count < maxStatck
                ) {
                    let minus_count = item.count < need_count ? item.count : need_count;
                    need_count -= minus_count;
                    srvDrag.count += minus_count;
                    item.count -= minus_count;
                    if (item.count < 1) {
                        srvInv[i] = null;
                    }
                    resultFlags |= CHANGE_RESULT_FLAG_INVENTORY;
                }
            }
            return resultFlags;
        } else if  (cliDrag && cliSlot && cliDrag.id !== cliSlot.id) { // swapped items
            if (!slotsEqual(prevCliSlot, cliDrag) || !slotsEqual(prevCliDrag, cliSlot)) {
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
                cliSlot.count > maxStatck
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
        // some unknown case
        return 0;
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
        // @todo Generate random treasure chest content
        const rnd = new alea(this.world.seed + pos.toHash());
        const slots = {};
        const bm = this.world.block_manager;
        const items_kit = [
            {id: bm.fromName('IRON_INGOT').id,          count: [1, 1, 1, 1, 2, 2, 3, 5]},
            {id: bm.fromName('WHEAT_SEEDS').id,         count: [0, 0, 1, 2, 3, 8]},
            {id: bm.fromName('CARROT_SEEDS').id,        count: [0, 0, 0, 2, 2, 4, 4, 8]},
            {id: bm.fromName('STONE_SWORD').id,         count: [0, 0, 0, 0, 0, 1]},
            {id: bm.fromName('STONE_SHOVEL').id,        count: [0, 0, 0, 0, 1]},
            {id: bm.fromName('BREAD').id,               count: [1, 1, 2]},
            {id: bm.fromName('WHEAT').id,               count: [1, 1, 2, 2, 3]},
            {id: bm.fromName('APPLE').id,               count: [0, 0, 0, 0, 1]},
            {id: bm.fromName('OAK_SIGN').id,            count: [0, 0, 0, 1, 1, 2, 2, 3]},
            {id: bm.fromName('COBBLESTONE').id,         count: [0, 0, 0, 4, 4, 8, 8, 16]},
            {id: bm.fromName('MUSIC_DISC_3').id,        count: [0, 0, 1]},
        ];
        //
        if(['treasure_room', 'cave_mines'].indexOf(params.source) >= 0) {
            items_kit.push(...[
                {id: bm.fromName('GOLD_INGOT').id,      count: [0, 0, 1, 1, 2, 2, 3, 3, 4]},
                {id: bm.fromName('DIAMOND_SWORD').id,   count: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]},
                {id: bm.fromName('JUKEBOX').id,         count: [0, 0, 0, 1]},
                {id: bm.fromName('DIAMOND').id,         count: [0, 0, 0, 0, 1, 2]},
                {id: bm.fromName('IRON_BARS').id,       count: [0, 0, 0, 2, 2, 4, 4, 8]},
                {id: bm.fromName('MUSIC_DISC_1').id,    count: [0, 0, 0, 1]},
                {id: bm.fromName('MUSIC_DISC_2').id,    count: [0, 0, 0, 1]},
                // MUSIC_DISC_3 removed, because it in regular generated chests
                {id: bm.fromName('MUSIC_DISC_4').id,    count: [0, 0, 0, 1]},
                {id: bm.fromName('MUSIC_DISC_5').id,    count: [0, 0, 0, 1]},
                {id: bm.fromName('MUSIC_DISC_6').id,    count: [0, 0, 1]},
                {id: bm.fromName('MUSIC_DISC_7').id,    count: [0, 0, 0, 1]},
                {id: bm.fromName('MUSIC_DISC_8').id,    count: [0, 0, 0, 0, 0, 0, 1]},
            ]);
        }
        //
        if(pos.y > 500) {
            items_kit.push(...[
                {id: bm.fromName('PRISMARINE').id,      count: [0, 0, 2, 2, 4, 4, 6, 6, 8]},
                {id: bm.fromName('SEA_LANTERN').id,     count: [0, 0, 1, 1, 2, 2, 3, 3, 4]},
            ]);
        }
        //
        for(let i = 0; i < DEFAULT_CHEST_SLOT_COUNT; i++) {
            if(rnd.double() > .8) {
                continue;
            }
            const kit_index = Math.floor(rnd.double() * items_kit.length);
            const item = {...items_kit[kit_index]};
            item.count = item.count[Math.floor(rnd.double() * item.count.length)];
            if(item.count > 0) {
                slots[i] = item;
                const b = BLOCK.fromId(item.id);
                if(b.power != 0) {
                    item.power = b.power;
                }
            }
        }

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