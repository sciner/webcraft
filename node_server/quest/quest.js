import {QuestActionType} from "./action_type.js";
import {QuestActionPickup} from "./action_pickup.js";
import {QuestActionSetBlock} from "./action_setblock.js";
import {QuestActionCraft} from "./action_craft.js";
import { Vector } from "../../www/js/helpers.js";
import { BLOCK } from "../../www/js/blocks.js";

// Quest
export class Quest {

    #quest_player;
    #player;
    #next_quests;

    constructor(quest_player, quest) {
        this.#quest_player  = quest_player;
        this.#player        = quest_player.player;
        this.#next_quests   = quest.next_quests ? JSON.parse(quest.next_quests) : [];
        //
        this.id             = quest.id;
        this.title          = quest.title;
        this.description    = quest.description;
        this.rewards        = quest.rewards;
        this.is_completed   = quest.is_completed;
        this.in_progress    = quest.in_progress;
        // Parse actions
        this.actions = [];
        for(let action of quest.actions) {
            switch(action.quest_action_type_id) {
                case QuestActionType.PICKUP: {
                    const obj = new QuestActionPickup(this, action)
                    this.actions.push(obj);
                    break;
                }
                case QuestActionType.SET_BLOCK: {
                    const obj = new QuestActionSetBlock(this, action)
                    this.actions.push(obj);
                    break;
                }
                case QuestActionType.CRAFT: {
                    const obj = new QuestActionCraft(this, action)
                    this.actions.push(obj);
                    break;
                }
                case QuestActionType.USE_ITEM:
                case QuestActionType.GOTO_COORD: {
                    throw 'error_not_implemented';
                    break;
                }
            }
        }
    }

    async checkAndSave() {
        await this.check();
        await this.save();
        // обновить квесты у игрока
        this.#quest_player.sendAll();
    }

    // Check
    async check() {
        if(this.is_completed) {
            return false;
        }
        let ok = true;
        this.in_progress = false;
        for(let action of this.actions) {
            if(action.in_progress) {
                this.in_progress = true;
            }
            if(!action.ok) {
                ok = false;
            }
        }
        //
        if(ok) {
            await this.complete();
        }
    }

    // Quest completed
    async complete() {
        const server_player = this.#player;
        const world = server_player.world;
        const pos = server_player.state.pos.clone();
        //
        console.log(`Quest ${this.id} completed by ${server_player.session.username}`);
        //
        this.is_completed = true;
        // Выдать приз
        for(let reward of this.rewards) {
            const reward_item = {
               id: reward.block_id,
               count: reward.cnt
            };
            //
            const block = BLOCK.fromId(reward_item.id);
            if(block) {
                server_player.inventory.increment(reward_item);
                // отправить сообщение
                this.#quest_player.sendMessage(`You have got reward ${block.name}x${reward_item.count}`);
            }
        }
        // @todo Сделать доступными новые квесты в ветке
        for(let next_quest_id of this.#next_quests) {
            const next_quest = await this.#quest_player.quest_manager.loadQuest(next_quest_id);
            await this.#quest_player.quest_manager.savePlayerQuest(this.#player, next_quest);
        }
        // отправить сообщение
        this.#quest_player.sendMessage(`You completed quest '${this.title}'`);
        //
        await this.#quest_player.loadQuests();
    }

    //
    async save() {
        return await this.#quest_player.quest_manager.savePlayerQuest(this.#player, this);
    }

}