import {BLOCK} from "../../www/js/blocks.js";
import {PlayerEvent} from "../player_event.js";
import {Quest} from "./quest.js";
import {QuestGroup} from "./quest_group.js";
import {QuestActionType} from "./action_type.js";
import {ServerClient} from "../../www/js/server_client.js";

// QuestPlayer
export class QuestPlayer {

    constructor(quest_manager, player) {
        this.quest_manager = quest_manager;
        this.player = player;
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
        let user_quests = await this.player.world.db.loadPlayerQuests(this.player);
        let need_load = false;
        for(let group of all_enabled_quest_groups) {
            for(let quest of group.quests) {
                if(!user_quests.has(quest.id)) {
                    // Добавить в БД квест для игрока, если его ещё там не было
                    await this.player.world.db.savePlayerQuest(this.player, quest);
                    need_load = true;
                }
            }
        }
        if(need_load) {
            user_quests = await this.player.world.db.loadPlayerQuests(this.player);
        }
        // Init quest objects
        this.groups = [];
        this.quests = new Map();
        for(let g of all_enabled_quest_groups) {
            const group = new QuestGroup(g);
            const group_quests = JSON.parse(JSON.stringify(g.quests));
            for(let quest_row of group_quests) {
                const user_quest = user_quests.get(quest_row.id);
                if(user_quest) {
                    quest_row.actions = user_quest.actions;
                    quest_row.is_completed = user_quest.is_completed;
                    quest_row.in_progress = user_quest.in_progress;
                }
                const quest = new Quest(this, quest_row);
                this.quests.set(quest.id, quest);
                group.addQuest(quest);
            }
            this.groups.push(group);
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
        for(let quest of this.quests.values()) {
            if(quest.is_completed) {
                continue;
            }
            for(let action of quest.actions) {
                if(action.ok) {
                    continue;
                }
                if(action.quest_action_type_id == QuestActionType.SET_BLOCK) {
                    action.processTriggerEvent(quest, e);
                }
            }
        }
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
        for(let quest of this.quests.values()) {
            if(quest.is_completed) {
                continue;
            }
            for(let action of quest.actions) {
                if(action.ok) {
                    continue;
                }
                if(action.quest_action_type_id == QuestActionType.PICKUP) {
                    action.processTriggerEvent(quest, e);
                }
            }
        }
    }

    // Handler
    onCraft(e) {
        const item = e.data.item;
        const block = BLOCK.fromId(item.block_id);
        if(!block) {
            throw 'error_invalid_block';
        }
        for(let quest of this.quests.values()) {
            if(quest.is_completed) {
                continue;
            }
            for(let action of quest.actions) {
                if(action.ok) {
                    continue;
                }
                if(action.quest_action_type_id == QuestActionType.CRAFT) {
                    action.processTriggerEvent(quest, e);
                }
            }
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

    // sendAll...
    sendAll() {
        const data = this.getEnabled();
        this.player.sendPackets([{name: ServerClient.CMD_QUEST_ALL, data: data}]);
    }

}