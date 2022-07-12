import {Vector} from "../../www/js/helpers.js";
import {ServerClient} from "../../www/js/server_client.js";
import {BLOCK} from "../../www/js/blocks.js";
import {getChunkAddr} from "../../www/js/chunk_const.js";
import { alea } from "../../www/js/terrain_generator/default.js";
import { InventoryComparator } from "../../www/js/inventory_comparator.js";
import { DEFAULT_CHEST_SLOT_COUNT } from "../../www/js/constant.js";

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