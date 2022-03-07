import {BLOCK} from "../../www/js/blocks.js";
import {PlayerEvent} from "../player_event.js";
import {Quest} from "./quest.js";
import {QuestGroup} from "./quest_group.js";
import {QuestActionType} from "./action_type.js";

// QuestPlayer
export class QuestPlayer {

    constructor(quest_manager, player) {
        this.quest_manager = quest_manager;
        this.player = player;
        this.init();
    }

    async init() {
        // Init handlers
        this.handlers = new Map();
        this.handlers.set(PlayerEvent.SET_BLOCK, this.onSetBlock);
        this.handlers.set(PlayerEvent.DESTROY_BLOCK, this.onDestroyBlock);
        this.handlers.set(PlayerEvent.PICKUP_ITEMS, this.onPickup);
        this.handlers.set(PlayerEvent.CRAFT, this.onCraft);
        this.handlers.set(PlayerEvent.PUT_ITEM_TO_INVENTORY, this.onItemToInventory);
        PlayerEvent.addHandler(this.player.session.user_id, this);
        // Get all quests in game
        const all_enabled_quest_groups = this.quest_manager.getEnabled();
        // Load user quests from DB
        let quests = await this.player.world.db.loadPlayerQuests(this.player);
        let need_load = false;
        for(let group of all_enabled_quest_groups) {
            for(let quest of group.quests) {
                // Добавить в БД квест для игрока, если его ещё там не было
                if(!quests.has(quest.id)) {
                    let actions = [...quest.actions];
                    await this.player.world.db.savePlayerQuestActions(this.player, quest.id, actions);
                    need_load = true;
                }
            }
        }
        if(need_load) {
            quests = await this.player.world.db.loadPlayerQuests(this.player);
        }
        // Init quest objects
        this.groups = [];
        this.quests = new Map();
        for(let g of all_enabled_quest_groups) {
            const group = new QuestGroup(g)
            for(let pq of g.quests) {
                const quest = new Quest(this, pq);
                this.quests.set(quest.id, quest);
                group.addQuest(quest);
            }
            this.groups.push(group)
        }

    }

    // Return player quest groups
    getEnabled() {
        return this.groups;
    }

    // Send message to player chat
    sendMessage(message) {
        this.player.world.chat.sendSystemChatMessageToSelectedPlayers(message, [this.player.session.user_id]);
    }

    // Handler
    onSetBlock(e) {
        const block = BLOCK.fromId(e.data.block.id);
        if(!block) {
            throw 'error_invalid_block';
        }
        const pos = e.data.pos.toHash();
        this.sendMessage(`${e.player.session.username} set block ${block.name} on pos ${pos}`);
    }

    // Handler
    onDestroyBlock(e) {
        const block = BLOCK.fromId(e.data.block_id);
        if(!block) {
            throw 'error_invalid_block';
        }
        const pos = e.data.pos.toHash();
        this.sendMessage(`${e.player.session.username} destroy block ${block.name} on pos ${pos}`);
    }

    // Handler
    onPickup(e) {
        const items_string = JSON.stringify(e.data.items);
        for(let quest of this.quests.values()) {
            for(let action of quest.actions) {
                if(action.quest_action_type_id == QuestActionType.PICKUP) {
                    console.log(quest.title, action);
                }
            }
        }
        this.sendMessage(`${e.player.session.username} pick up dropped items ${items_string}`);
    }

    // Handler
    onCraft(e) {
        const item = e.data.item;
        const block = BLOCK.fromId(item.block_id);
        if(!block) {
            throw 'error_invalid_block';
        }
        this.sendMessage(`${e.player.session.username} crafted ${block.name} (count: ${item.count})`);
    }

    // Handler
    onItemToInventory(e) {
        const item = e.data.item;
        const block = BLOCK.fromId(item.block_id);
        if(!block) {
            throw 'error_invalid_block';
        }
        this.sendMessage(`${e.player.session.username} put item ${block.name} to inventory`);
    }

    // On game event
    trigger(e) {
        const handler = this.handlers.get(e.type);
        if(handler) {
            handler.call(this, e);
        }
    }

}