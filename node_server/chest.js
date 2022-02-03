import { BLOCK } from "../www/js/blocks.js";
import {getChunkAddr} from "../www/js/chunk.js";
import {ServerClient} from "../www/js/server_client.js";

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
        this.#world = world;
        this.#pos = pos;
        this.user_id = user_id;
        this.time = time;
        this.item = item;
        this.slots = slots;
    }

    // Действие со слотом сундука
    async slotAction(player, slot_index, cursor_item, options) {
        let cloneObj = (obj) => {
            return JSON.parse(JSON.stringify(obj));
        };
        //
        cursor_item = cursor_item ? BLOCK.convertItemToInventoryItem(cursor_item) : null;
        // Проверяем есть ли действительно у игрока данный предмет в необходимом количестве (учитываются также ломаемые инструменты/оружия, у которых есть какой-то ресурс)
        const has_item = cursor_item && player.inventory.hasItem(cursor_item);
        if(cursor_item) {
            if(!has_item) {
                return false;
            }
            // calc dispensed quantity
            // Math.ceil(cursor_item.count / 2)
            cursor_item.count = options.secondButton ? 1 : cursor_item.count;
        }
        // Check slot can take
        let old_slot_item = this.slots[slot_index];
        const is_exchange = (old_slot_item && cursor_item) && (old_slot_item.id != cursor_item.id);
        const is_append = (old_slot_item && cursor_item) && (old_slot_item.id == cursor_item.id);
        const is_set = (!is_exchange && !is_append) && cursor_item;
        const is_get = (!is_exchange && !is_append) && old_slot_item;
        console.log({is_exchange, is_append, is_set, is_get});
        if(is_exchange) {
            // exchange
            this.slots[slot_index] = cloneObj(cursor_item);
            player.inventory.drag_item = old_slot_item;
        } else if(is_append) {
            // append
            let b = BLOCK.fromId(cursor_item.id);
            let new_count = this.slots[slot_index].count + cursor_item.count;
            if(new_count > b.max_in_stack) {
                cursor_item.count = b.max_in_stack - this.slots[slot_index].count;
                new_count = b.max_in_stack;
            }
            this.slots[slot_index].count = new_count;
        } else if(is_set) {
            // set
            this.slots[slot_index] = cloneObj(cursor_item);
        } else if(is_get) {
            // get
            player.inventory.drag_item = old_slot_item;
            this.slots[slot_index] = null;
        } else {
            throw 'error_impossible_case';
        }
        // decrement from inventory
        if(cursor_item) {
            player.inventory.decrementItem(cursor_item);
            console.log('decremtntItem', JSON.stringify(cursor_item));
            console.log(' inventory: ', JSON.stringify(player.inventory.items));
        }
        //
        console.log(' slots: ', JSON.stringify(this.slots));
        // increment to slot
        // send all new chest slot item to players
        // Save chest slots to DB
        this.#world.db.saveChestSlots(this);
        //
        this.sendItem();
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