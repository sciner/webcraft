import {QuestActionType} from "./action_type.js";
import {QuestActionPickup} from "./action_pickup.js";
import {QuestActionSetBlock} from "./action_setblock.js";
import {QuestActionCraft} from "./action_craft.js";
import { BLOCK } from "../../www/js/blocks.js";
import {DBWorldQuest} from "../db/world/quest.js"
import {ServerPlayer} from "../server_player.js"

// Quest
export class Quest {

    static DIRTY_FLAG_NEW       = 0x1;
    static DIRTY_FLAG_UPDATED   = 0x2;

    #quest_player;
    #player;
    #next_quests;
    #dirtyFlags;

    /**
     * @param {QuestPlayer} quest_player
     * @param {Object} quest - either an existing quest of this player returned by {@link DBWorldQuest.loadPlayerQuests},
     *  or a general quest description returned by {@link DBWorldQuest.load}, {@link DBWorldQuest.defaults} or 
     * @param {Boolean} isNew - true if the quest is just created, and not addede to the DB,
     *  false if it already exists in DB
     */
    constructor(quest_player, quest, isNew) {
        this.#quest_player  = quest_player;
        this.#player        = quest_player.player;
        this.#next_quests   = quest.next_quests ? JSON.parse(quest.next_quests) : [];
        //
        this.id             = quest.id;
        this.title          = quest.title;
        this.description    = quest.description;
        this.rewards        = quest.rewards;
        this.is_completed   = quest.is_completed ?? false;
        // This field is the exact value of in_progress from DB.
        // For the field with the same semantics as in_progress had before the world transaction, use in_progress.
        this.db_in_progress = quest.in_progress ?? false;
        this.#dirtyFlags    = 0;
        if (isNew) {
            this.#dirtyFlags = Quest.DIRTY_FLAG_NEW;
            this.#player.dirtyFlags |= ServerPlayer.DIRTY_FLAG_QUESTS;
        }
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

    /**
     * Before the world transaction, quests wered and loaded for each change.
     * When they were loaded, it was like this:
     *   row.in_progress = !row.is_completed && row.in_progress != 0;
     * This getter simulates the same behavior when changing the quest in-memory.
     */
    get in_progress() {
        return this.db_in_progress && !this.is_completed;
    }

    set in_progress(v) {
        this.db_in_progress = v;
    }

    async checkAndMarkDirty() {
        await this.check();
        this.markDirty();
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
        this.markDirty();
        // @todo Сделать доступными новые квесты в ветке
        for(let next_quest_id of this.#next_quests) {
            const next_quest = await this.#quest_player.quest_manager.loadQuest(next_quest_id);
            this.#quest_player.addQuest(next_quest, true);
        }
        // отправить сообщение
        this.#quest_player.sendMessage(`You completed quest '${this.title}'`);
    }

    // Marks that the quest must be saved in the next world transaction
    markDirty() {
        this.#dirtyFlags        |= Quest.DIRTY_FLAG_UPDATED;
        this.#player.dirtyFlags |= ServerPlayer.DIRTY_FLAG_QUESTS;
    }

    writeToWorldTransaction(underConstruction) {
        if (this.#dirtyFlags) {
            const player = this.#player;
            const row = DBWorldQuest.playerQuestToRow(player, this);
            const list = this.#dirtyFlags & Quest.DIRTY_FLAG_NEW
                ? underConstruction.insertQuests
                : underConstruction.updateQuests;
            list.push(row);
            this.#dirtyFlags = 0;
        }
    }
}