import { BLOCK } from "../www/js/blocks.js";
import {getChunkAddr} from "../www/js/chunk.js";
import {ServerClient} from "../www/js/server_client.js";
import {InventoryComparator} from "../www/js/inventory_comparator.js";

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

    // Подтвердить действие с сундуком
    async confirmPlayerAction(player, params) {
        let old_items = [...player.inventory.items, ...Array.from(Object.values(this.slots))];
        let new_items = [...[params.drag], ...params.inventory_slots, ...params.chest.slots];
        let equal = await InventoryComparator.checkEqual(old_items, new_items, []);
        console.log(equal, 'Need to send all new chest slot state to players');
        // @todo Send all new chest slot state to players
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