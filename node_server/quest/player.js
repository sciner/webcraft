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
        //
        await this.startQuests();
        await this.loadQuests();
    }

    // Start quests
    async startQuests() {
        // 1. check if default not started
        let quests_started = await this.quest_manager.questsUserStarted(this.player);
        if(!quests_started) {
            // Get all quests in game
            const all_enabled_quest_groups = this.quest_manager.getDefaultQuests();
            for(let group of all_enabled_quest_groups) {
                for(let quest of group.quests) {
                    // Start default user quests
                    await this.quest_manager.savePlayerQuest(this.player, quest);
                }
            }
        }
    }

    async loadQuests() {
        const user_quests = await this.quest_manager.loadPlayerQuests(this.player);
        // Init quest objects
        this.groups = new Map();
        this.quests = new Map();
        //
        for(let item of user_quests) {
            let group = this.groups.get(item.quest_group.id);
            if(!group) {
                group = new QuestGroup(item.quest_group);
                this.groups.set(group.id, group);
            }
            const quest = new Quest(this, item);
            this.quests.set(quest.id, quest);
            group.addQuest(quest);
        }
        //
        this.groups = Array.from(this.groups.values());
    }

    // Return player quest groups
    getEnabled() {
        return this.groups;
    }

    // sendAll...
    async sendAll() {
        await this.loadQuests();
        const data = this.getEnabled();
        this.player.sendPackets([{name: ServerClient.CMD_QUEST_ALL, data: data}]);
    }

    // Send message to player chat
    sendMessage(message) {
        this.player.world.chat.sendSystemChatMessageToSelectedPlayers(message, [this.player.session.user_id]);
    }

    // Handler
    async onSetBlock(e) {
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
                    await action.processTriggerEvent(quest, e);
                }
            }
        }
        // this.sendMessage(`${e.player.session.username} set block ${block.name} on pos ${pos}`);
    }

    // Handler
    async onDestroyBlock(e) {
        const block = BLOCK.fromId(e.data.block_id);
        if(!block) {
            throw 'error_invalid_block';
        }
        const pos = e.data.pos.toHash();
        // this.sendMessage(`${e.player.session.username} destroy block ${block.name} on pos ${pos}`);
    }

    // Handler
    async onPickup(e) {
        for(let quest of this.quests.values()) {
            if(quest.is_completed) {
                continue;
            }
            for(let action of quest.actions) {
                if(action.ok) {
                    continue;
                }
                if(action.quest_action_type_id == QuestActionType.PICKUP) {
                    await action.processTriggerEvent(quest, e);
                }
            }
        }
    }

    // Handler
    async onCraft(e) {
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
                    await action.processTriggerEvent(quest, e);
                }
            }
        }
        // this.sendMessage(`${e.player.session.username} crafted ${block.name} (count: ${item.count})`);
    }

    // Handler
    async onItemToInventory(e) {
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
                if(action.quest_action_type_id == QuestActionType.PICKUP) {
                    await action.processTriggerEvent(quest, e);
                }
            }
        }
        // this.sendMessage(`${e.player.session.username} put item ${block.name} to inventory`);
    }

    // On game event
    trigger(e) {
        const handler = this.handlers.get(e.type);
        if(handler) {
            handler.call(this, e);
        }
    }

}