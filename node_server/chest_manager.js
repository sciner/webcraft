import {Vector} from "../www/js/helpers.js";
import {ServerClient} from "../www/js/server_client.js";
import {BLOCK} from "../www/js/blocks.js";
import {getChunkAddr} from "../www/js/chunk.js";
import { alea } from "../www/js/terrain_generator/default.js";
import { InventoryComparator } from "../www/js/inventory_comparator.js";
import { DEFAULT_CHEST_SLOT_COUNT } from "../www/js/constant.js";

export class ChestManager {

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
            throw 'error_chest_not_found';
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

    //
    async confirmPlayerAction(player, pos, params) {

        const chest = await this.get(pos);

        if(!('slots' in chest.extra_data)) {
            chest.extra_data.slots = {};
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

        // Compare server state and new state from player
        const old_items = [...player.inventory.items, ...Array.from(Object.values(chest.extra_data.slots))];
        const new_items = [...params.inventory_slots, ...Array.from(Object.values(new_chest_slots))];
        const equal = await InventoryComparator.checkEqual(old_items, new_items, []);

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
            chest.extra_data.slots = new_chest_slots;
            chest.extra_data.can_destroy = !new_chest_slots || Object.entries(new_chest_slots).length == 0;
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
            // @todo
            player.inventory.refresh(true);
        }
    }

    // Send block item
    // @todo without slots
    async sendItem(block_pos, chest) {
        let chunk_addr = getChunkAddr(block_pos);
        let chunk = this.world.chunks.get(chunk_addr);
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
    sendContentToPlayers(players, block_pos) {
        let tblock = this.world.getBlock(block_pos);
        if(!tblock || tblock.id < 0) {
            return false;
        }
        if(!tblock.extra_data || !tblock.extra_data.slots) {
            return false;
        }
        const chest = {
            pos:            tblock.posworld,
            slots:          tblock.extra_data.slots,
            can_destroy:    tblock.extra_data.can_destroy,
            state:          tblock.extra_data.state
        };
        for(let player of players) {
            let packets = [{
                name: ServerClient.CMD_CHEST_CONTENT,
                data: chest
            }];
            player.sendPackets(packets);
        }
        return true;
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

    // Generate chest
    async generateChest(pos, rotate, params) {
        // @todo Generate random treasure chest content
        const rnd = new alea(this.world.seed + pos.toHash());
        const slots = {};
        const items_kit = [
            {id: 637, count: [1, 1, 1, 1, 2, 2, 3, 5]}, // IRON_INGOT
            {id: 59, count: [0, 0, 1, 2, 3, 8]}, // WHEAT_SEEDS
            {id: 635, count: [0, 0, 0, 2, 2, 4, 4, 8]}, // CARROT_SEEDS
            {id: 607, count: [0, 0, 0, 0, 0, 1]}, // STONE_SWORD
            {id: 561, count: [0, 0, 0, 0, 1]}, // STONE_SHOVEL
            {id: 634, count: [1, 1, 2]}, // BREAD
            {id: 633, count: [1, 1, 2, 2, 3]}, // WHEAT
            {id: 613, count: [0, 0, 0, 0, 1]}, // APPLE
            {id: 643, count: [0, 0, 0, 1, 1, 2, 2, 3]}, // OAK_SIGN
            {id: 8, count: [0, 0, 0, 4, 4, 8, 8, 16]}, // COBBLESTONE
            //
            {id: 903, count: [0, 0, 1]}, // MUSIC_DISC 3
        ];
        //
        if(['treasure_room', 'cave_mines'].indexOf(params.source) >= 0) {
            items_kit.push(...[
                {id: 638, count: [0, 0, 1, 1, 2, 2, 3, 3, 4]}, // GOLD_INGOT
                {id: 610, count: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]}, // DIAMOND_SWORD
                {id: 84, count: [0, 0, 0, 1]}, // JUKEBOX
                {id: 641, count: [0, 0, 0, 0, 1, 2]}, // DIAMOND
                {id: 626, count: [0, 0, 0, 2, 2, 4, 4, 8]}, // IRON_BARS
                {id: 901, count: [0, 0, 0, 1]}, // MUSIC_DISC 1
                {id: 902, count: [0, 0, 0, 1]}, // MUSIC_DISC 2
                // 903 removed, because it in regular generated chests
                {id: 904, count: [0, 0, 0, 1]}, // MUSIC_DISC 4
                {id: 905, count: [0, 0, 0, 1]}, // MUSIC_DISC 5
                {id: 906, count: [0, 0, 1]}, // MUSIC_DISC 6
                {id: 907, count: [0, 0, 0, 1]}, // MUSIC_DISC 7
                {id: 908, count: [0, 0, 0, 0, 0, 0, 1]}, // MUSIC_DISC 8
            ]);
        }
        //
        for(let i = 0; i < 27; i++) {
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