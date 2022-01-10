import uuid from 'uuid';

import { Vector, VectorCollector } from "../www/js/helpers.js";

export class EntityManager {

    constructor(world) {
        this.world = world;
        this.chests = new Map();
        this.blocks = new VectorCollector(); // Блоки занятые сущностями (содержат ссылку на сущность) Внимание! В качестве ключа используется сериализованные координаты блока
        this.load();
    }

    // Load from DB
    async load() {
        let resp = await this.world.db.loadWorldChests(this.world);
        this.chests = resp.chests;
        this.blocks = resp.blocks;
    }

    // LoadChest...
    async loadChest(player, params) {
        if(this.chests.has(params.entity_id)) {
            return await player.sendChest(this.chests.get(params.entity_id));
        }
        throw 'Chest ' + params.entity_id + ' not found';
    }

    async delete(entity_id, pos) {
        await this.world.db.deleteChest(entity_id);
        this.chests.delete(entity_id);
        this.blocks.delete(pos);
    }

    // Generate ID
    generateID() {
        const guid = uuid();
        if(this.chests.has(guid)) {
            return this.generateID();
        }
        return guid;
    }

    // Return entity on this block position
    getEntityByPos(pos) {
        if(this.blocks.has(pos)) {
            let be = this.blocks.get(pos);
            // Block occupied by another entity
            switch (be.type) {
                case 'chest': {
                    return {
                        entity: this.chests.get(be.id),
                        type: be.type
                    };
                    break;
                }
            }
        }
        return null;
    }

    /**
     * Create chest 
     * @param {*} player 
     * @param {ParamBlockSet} params 
     */
    async createChest(player, params) {
        if(this.blocks.has(params.pos)) {
            throw 'error_block_occupied_by_another_entity';
        }
        // @Chest
        let entity = {
            user_id:    player.session.user_id,
            time:       ~~(Date.now() / 1000),
            item:       params.item,
            slots:      {}, // Array(27) // @ChestSlot
        }
        entity.item.entity_id = this.generateID();
        this.chests.set(entity.item.entity_id, entity);
        // @EntityBlock
        this.blocks.set(params.pos, {
            id:   entity.item.entity_id,
            type: 'chest'
        });
        // Save to DB
        await this.world.db.createChest(player, params.pos, entity);
        return entity.item.entity_id;
    }

    // Получены новые данные о содержимом слоте сундука
    async setChestSlotItem(player, params) {
        if(this.chests.has(params.entity_id)) {
            let chest = this.chests.get(params.entity_id);
            let new_count = params?.item?.count || 0;
            if (new_count == 0) {
                delete(chest.slots[params.slot_index]);
            } else {
                // @ChestSlot
                chest.slots[params.slot_index] = {
                    id:         params.item.id,
                    count:      params.item.count,
                    entity_id:  params.item.entity_id,
                    power:      params.item.power,
                }
            }
            // Save chest slots to DB
            this.world.db.saveChestSlots(chest);
        }
    }

}