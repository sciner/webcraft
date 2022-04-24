import { v4 as uuid } from 'uuid';
import {Vector, VectorCollector } from "../www/js/helpers.js";
import { Chest } from './chest.js';
import {ServerClient} from "../www/js/server_client.js";
import {BLOCK} from "../www/js/blocks.js";

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
    async create(player, params, options = {check_occupied: true, slots: {}}) {
        const check_occupied = options ? options.check_occupied : true;
        const slots = options ? options.slots : {}; // Array(27) // @ChestSlot
        if(check_occupied && this.blocks.has(params.pos)) {
            throw 'error_block_occupied_by_another_entity';
        }
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

    async getByInfo(player, info) {
        if(info.entity_id) {
            return this.get(info.entity_id);
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
                        if(b.power != 1) {
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