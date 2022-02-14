import { BLOCK } from "../www/js/blocks.js";
import {getChunkAddr} from "../www/js/chunk.js";
import {ServerClient} from "../www/js/server_client.js";
import {InventoryComparator} from "../www/js/inventory_comparator.js";

export const DEFAULT_CHEST_SLOT_COUNT = 27;

export class Chest {

    #world;
    #pos;

    /**
     * Сундук
     * @param {number} user_id Кто автор
     * @param {string} time Время создания, time.Now()
     * @param {Object} item Предмет
     * @param {Object[]} slots Слоты
     */
    constructor(world, pos, user_id, time, item, slots) {
        this.#world         = world;
        this.#pos           = pos;
        this.pos            = pos;
        this.user_id        = user_id;
        this.time           = time;
        this.item           = item;
        this.slots_count    = DEFAULT_CHEST_SLOT_COUNT;
        this.slots          = slots;
    }

    // Подтвердить действие с сундуком
    async confirmPlayerAction(player, params) {
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
        let old_items = [...[player.inventory.drag_item], ...player.inventory.items, ...Array.from(Object.values(this.slots))];
        let new_items = [...[params.drag_item], ...params.inventory_slots, ...Array.from(Object.values(new_chest_slots))];
        let equal = await InventoryComparator.checkEqual(old_items, new_items, []);
        //
        const sendChestToPlayers = (except_player_ids) => {
            let chunk_addr = getChunkAddr(this.#pos);
            const chunk = this.#world.chunks.get(chunk_addr);
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
                this.sendContentToPlayers(players);
            }
        };
        //
        if(equal) {
            // update chest slots
            this.slots = new_chest_slots;
            // update player drag item
            player.inventory.drag_item = params.drag_item;
            // update player inventory
            player.inventory.applyNewItems(params.inventory_slots, false);
            player.inventory.refresh(false);
            // Send new chest state to players
            sendChestToPlayers([player.session.user_id]);
            // Save chest slots to DB
            await this.#world.db.saveChestSlots(this);
            //
            this.sendItem();
        } else {
            this.sendContentToPlayers([player]);
            player.inventory.refresh(true);
        }
    }

    // Send block item without slots
    async sendItem() {
        this.item.extra_data.can_destroy = Object.entries(this.slots).length == 0;
        let chunk_addr = getChunkAddr(this.#pos);
        let chunk = this.#world.chunks.get(chunk_addr);
        if(chunk) {
            const packets = [{
                name: ServerClient.CMD_BLOCK_SET,
                data: {pos: this.#pos, item: this.item}
            }];
            chunk.sendAll(packets, []);
        }
    }

    // Отправка содержимого сундука
    async sendContentToPlayers(players) {
        for(let player of players) {
            let packets = [{
                name: ServerClient.CMD_CHEST_CONTENT,
                data: this
            }];
            player.sendPackets(packets);
        }
    }

}