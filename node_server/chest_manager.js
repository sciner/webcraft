import uuid from 'uuid';

import {Vector, VectorCollector } from "../www/js/helpers.js";
import { Chest } from './chest.js';

export class ChestManager {

    constructor(world) {
        this.world = world;
        this.list = new Map();
        this.blocks = new VectorCollector(); // Блоки занятые сущностями (содержат ссылку на сущность) Внимание! В качестве ключа используется сериализованные координаты блока
        this.load();
    }

    // Load from DB
    async load() {
        let resp = await this.world.db.loadChests(this.world);
        this.list = resp.list;
        this.blocks = resp.blocks;
    }

    /**
     * Create chest 
     * @param {*} player 
     * @param {ParamBlockSet} params
     * @returns {Chest}
     */
    async create(player, params) {
        if(this.blocks.has(params.pos)) {
            throw 'error_block_occupied_by_another_entity';
        }
        const slots = {}; // Array(27) // @ChestSlot
        // @Chest
        let chest = new Chest(
            this.world,
            new Vector(params.pos.x, params.pos.y, params.pos.z),
            player.session.user_id,
            new Date().toISOString(),
            {...params.item, entity_id: this.generateID(), extra_data: {can_destroy: true}},
            slots
        );
        this.list.set(chest.item.entity_id, chest);
        // @EntityBlock
        this.blocks.set(params.pos, {
            id:   chest.item.entity_id,
            type: 'chest'
        });
        // Save to DB
        await this.world.db.createChest(player, params.pos, chest);
        return chest;
    }

    async delete(entity_id, pos) {
        await this.world.db.deleteChest(entity_id);
        this.list.delete(entity_id);
        this.blocks.delete(pos);
    }

    // Generate ID
    generateID() {
        const guid = uuid();
        if(this.list.has(guid)) {
            return this.generateID();
        }
        return guid;
    }

    /**
     * Return chest by entity_id
     * @param {string} entity_id 
     * @returns Chest|null
     */
    get(entity_id) {
        return this.list.get(entity_id) || null;
    }

    /**
     * Return chest on this block position
     * @param {Vector} pos 
     * @returns Chest|null
     */
    getOnPos(pos) {
        if(this.blocks.has(pos)) {
            let be = this.blocks.get(pos);
            // Block occupied by another entity
            switch (be.type) {
                case 'chest': {
                    return {
                        entity: this.list.get(be.id),
                        type: be.type
                    };
                    break;
                }
            }
        }
        return null;
    }

}