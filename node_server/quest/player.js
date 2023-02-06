import {PlayerEvent} from "../player_event.js";
import {Quest} from "./quest.js";
import {QuestGroup} from "./quest_group.js";
import {QuestActionType} from "./action_type.js";
import {ServerClient} from "../../www/js/server_client.js";
import {DBWorldQuest} from "../db/world/quest.js"

// QuestPlayer
export class QuestPlayer {

    constructor(quest_manager, player) {
        this.quest_manager = quest_manager;
        this.player = player;
        this.world = player.world
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
        await this.loadQuests();
    }

    /**
     * Adds a new quest to the current quests. It'll be saved in the next world transaction.
     * @param {Object} dbQuest - one quest returned by {@link DBWorldQuest.load},
     *  {@link DBWorldQuest.defaults} or {@link DBWorldQuest.loadPlayerQuests}
     */
    addQuest(dbQuest, isNew) {
        const groupId = dbQuest.quest_group_id;
        let group = this.groups.find(it => it.id === groupId);
        if (!group) {
            const dbGroup = this.quest_manager.getGroup(groupId);
            if (!dbGroup) {
                return; // the quest references a non-existent group
            }
            group = new QuestGroup(dbGroup);
            this.groups.push(group);
        }
        const quest = new Quest(this, dbQuest, isNew);
        this.quests.set(quest.id, quest);
        group.addQuest(quest);
    }

    // Starts all default quests if a player has no quests
    startDefaultQuests() {
        // Get all quest groups in game
        const all_enabled_quest_groups = this.quest_manager.getGroupsWithDefaultQuests();
        for(let group of all_enabled_quest_groups) {
            for(let quest of group.quests) {
                this.addQuest(quest, true);
            }
        }
    }

    async loadQuests() {
        const user_quests = await this.quest_manager.loadPlayerQuests(this.player);
        // Init quest objects
        this.groups = [];           // a Map might be better for performance, but an Array was historically used
        this.quests = new Map();    // by quest.id
        //
        if (user_quests.length == 0) {
            this.startDefaultQuests();
        } else {
            for(const uq of user_quests) {
                this.addQuest(uq, false);
            }
        }
    }

    // Return player quest groups
    getEnabled() {
        return this.groups;
    }

    // sendAll...
    sendAll() {
        const data = this.getEnabled();
        this.player.sendPackets([{name: ServerClient.CMD_QUEST_ALL, data: data}]);
    }

    // Send message to player chat
    sendMessage(message) {
        this.player.world.chat.sendSystemChatMessageToSelectedPlayers(message, [this.player.session.user_id]);
    }

    // Handler
    onSetBlock(e) {
        const block = this.world.block_manager.fromId(e.data.block.id);
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
        // this.sendMessage(`${e.player.session.username} set block ${block.name} on pos ${pos}`);
    }

    // Handler
    onDestroyBlock(e) {
        const block = this.world.block_manager.fromId(e.data.block_id);
        if(!block) {
            throw 'error_invalid_block';
        }
        const pos = e.data.pos.toHash();
        // this.sendMessage(`${e.player.session.username} destroy block ${block.name} on pos ${pos}`);
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
        const block = this.world.block_manager.fromId(item.block_id);
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
        // this.sendMessage(`${e.player.session.username} crafted ${block.name} (count: ${item.count})`);
    }

    // Handler
    onItemToInventory(e) {
        const item = e.data.item;
        const block = this.world.block_manager.fromId(item.block_id);
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
                    action.processTriggerEvent(quest, e);
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

    writeToWorldTransaction(underConstruction) {
        for(const quest of this.quests.values()) {
            quest.writeToWorldTransaction(underConstruction);
        }
    }

}