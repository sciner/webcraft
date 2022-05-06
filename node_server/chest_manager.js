import { v4 as uuid } from 'uuid';
import {Vector, VectorCollector } from "../www/js/helpers.js";
import {ServerClient} from "../www/js/server_client.js";
import {BLOCK} from "../www/js/blocks.js";
import {getChunkAddr} from "../www/js/chunk.js";
import {InventoryComparator} from "../www/js/inventory_comparator.js";

export const DEFAULT_CHEST_SLOT_COUNT = 27;

export class ChestManager {

    constructor(world) {
        this.world = world;
    }

    /**
     * Return chest by pos
     * @param {Vector} pos
     * @returns Chest|null
     */
    get(pos) {
        let block = this.world.getBlock(pos);
        return block;
    }

    //
    async confirmPlayerAction(player, pos, params) {

        const chest = this.get(pos);
        if(!('slots' in chest.extra_data)) {
            chest.extra_data.slots = {};
        }

        // Валидация ключей слотов сундука, а также самих айтемов путем их привидения к строгому формату
        let new_chest_slots = {};
        for(let k in params.chest.slots) {
            if(!isNaN(k) && k >= 0 && k < DEFAULT_CHEST_SLOT_COUNT) {
                let item = params.chest.slots[k];
                new_chest_slots[k] = BLOCK.convertItemToInventoryItem(item);
            }
        }

        //
        params.drag_item = params.drag_item ? BLOCK.convertItemToInventoryItem(params.drag_item) : null;
        //
        let old_items = [...[player.inventory.drag_item], ...player.inventory.items, ...Array.from(Object.values(chest.extra_data.slots))];
        let new_items = [...[params.drag_item], ...params.inventory_slots, ...Array.from(Object.values(new_chest_slots))];
        let equal = await InventoryComparator.checkEqual(old_items, new_items, []);
        //
        if(player.onPutInventoryItems) {
            let old_simple = InventoryComparator.groupToSimpleItems(player.inventory.items);
            let new_simple = InventoryComparator.groupToSimpleItems(params.inventory_slots);
            const put_items = [];
            for(let [key, item] of new_simple) {
                let old_item = old_simple.get(key);
                if(!old_item) {
                    put_items.push(item);
                }
            }
            for(let item of put_items) {
                player.onPutInventoryItems({block_id: item.id});
            }
        }
        //
        if(equal) {
            // update chest slots
            chest.extra_data.slots = new_chest_slots;
            chest.extra_data.can_destroy = !new_chest_slots || Object.entries(new_chest_slots).length == 0;
            // update player drag item
            player.inventory.drag_item = params.drag_item;
            // update player inventory
            player.inventory.applyNewItems(params.inventory_slots, false);
            player.inventory.refresh(false);
            // Send new chest state to players
            this.sendChestToPlayers(pos, [player.session.user_id]);
            // Save chest slots to DB
            await this.world.db.saveChestSlots({
                pos: pos,
                slots: chest.extra_data.slots
            });
            //
            this.sendItem(pos, chest);
        } else {
            this.sendContentToPlayers([player], pos);
            player.inventory.refresh(true);
        }
    }

    // Send block item without slots
    async sendItem(pos, chest) {
        let chunk_addr = getChunkAddr(pos);
        let chunk = this.world.chunks.get(chunk_addr);
        if(chunk) {
            const item = {
                id:         chest.id,
                extra_data: chest.extra_data,
                rotate:     chest.rotate
            };
            const packets = [{
                name: ServerClient.CMD_BLOCK_SET,
                data: {pos: pos, item: item}
            }];
            chunk.sendAll(packets, []);
        }
    }

    sendChestToPlayers(pos, except_player_ids) {
        let chunk_addr = getChunkAddr(pos);
        const chunk = this.world.chunks.get(chunk_addr);
        if(chunk) {
            let players = [];
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

    //
    sendContentToPlayers(players, pos) {
        let block = this.world.getBlock(pos);
        if(!block) {
            return false;
        }
        const chest = {
            pos:            block.posworld,
            slots:          block.extra_data.slots,
            can_destroy:    block.extra_data.can_destroy,
        }
        for(let player of players) {
            let packets = [{
                name: ServerClient.CMD_CHEST_CONTENT,
                data: chest
            }];
            player.sendPackets(packets);
        }
        return true;
    }

    async generateTreasureChest(player, pos) {
        /*
        if(info.pos) {
            return this.get(info.pos);
        } else if(info.pos) {
            let block = this.world.getBlock(info.pos);
            if(block && block.id == BLOCK_CHEST) {
                // @todo need to create new chest
                const params = {
                    pos: info.pos,
                    item:  {id: BLOCK_CHEST, power: 1, rotate: block.rotate}
                };
                // @todo Generate random treasure chest content
                const slots = {};
                const items_kit = [
                    {id: 637, count: [1, 1, 1, 1, 2, 2, 3, 5]}, // IRON_INGOT
                    {id: 638, count: [0, 0, 1, 1, 2, 2, 3, 3, 4]}, // GOLD_INGOT
                    {id: 59, count: [0, 0, 1, 2, 3, 8]}, // WHEAT_SEEDS
                    {id: 638, count: [0, 0, 0, 2, 2, 4, 4, 8]}, // CARROT_SEEDS
                    {id: 607, count: [0, 0, 0, 0, 0, 1]}, // STONE_SWORD
                    {id: 561, count: [0, 0, 0, 0, 1]}, // IRON_SHOVEL
                    {id: 610, count: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]}, // DIAMOND_SWORD
                    {id: 84, count: [0, 0, 0, 1]}, // JUKEBOX
                    {id: 634, count: [1, 1, 2]}, // BREAD
                    {id: 633, count: [1, 1, 2, 2, 3]}, // WHEAT
                    {id: 613, count: [0, 0, 0, 0, 1]}, // APPLE
                    {id: 641, count: [0, 0, 0, 0, 1, 2]}, // DIAMOND
                    {id: 643, count: [0, 0, 0, 1, 1, 2, 2, 3]}, // OAK_SIGN
                    {id: 626, count: [0, 0, 0, 2, 2, 4, 4, 8]}, // IRON_BARS
                    {id: 8, count: [0, 0, 0, 4, 4, 8, 8, 16]}, // COBBLESTONE
                    //
                    {id: 901, count: [0, 0, 0, 1]}, // MUSIC_DISC 1
                    {id: 902, count: [0, 0, 0, 1]}, // MUSIC_DISC 2
                    {id: 903, count: [0, 0, 1]}, // MUSIC_DISC 3
                    {id: 904, count: [0, 0, 0, 1]}, // MUSIC_DISC 4
                    {id: 905, count: [0, 0, 0, 1]}, // MUSIC_DISC 5
                    {id: 906, count: [0, 0, 1]}, // MUSIC_DISC 6
                    {id: 907, count: [0, 0, 0, 1]}, // MUSIC_DISC 7
                    {id: 908, count: [0, 0, 0, 0, 0, 0, 1]}, // MUSIC_DISC 8
                ];
                for(let i = 0; i < 27; i++) {
                    if(Math.random() > .8) {
                        continue;
                    }
                    const kit_index = Math.floor(Math.random() * items_kit.length);
                    const item = {...items_kit[kit_index]};
                    item.count = item.count[Math.floor(Math.random() * item.count.length)];
                    if(item.count > 0) {
                        slots[i] = item;
                        const b = BLOCK.fromId(item.id);
                        if(b.power != 0) {
                            item.power = b.power;
                        }
                    }
                }
                const chest = await this.create(player, params, {check_occupied: false, slots: slots});
                const actions = {
                    blocks: {
                        list: [
                            {pos: info.pos, item: chest.item, action_id: ServerClient.BLOCK_ACTION_CREATE}
                        ]
                    }
                };
                await this.world.applyActions(player, actions);
                return chest;
            }
        }
        return null;
        */
    }

}