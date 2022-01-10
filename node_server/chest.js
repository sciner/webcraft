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

    // Получены новые данные о содержимом слоте сундука
    async setSlotItem(player, slot_index, item) {
        let new_count = item?.count || 0;
        if (new_count == 0) {
            delete(this.slots[slot_index]);
        } else {
            // @ChestSlot
            this.slots[slot_index] = {
                id:         item.id,
                count:      item.count,
                entity_id:  item.entity_id,
                power:      item.power,
            }
        }
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