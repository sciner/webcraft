import {QuestActionType} from "./action_type.js";
import {QuestActionPickup} from "./action_pickup.js";
import {QuestActionSetBlock} from "./action_setblock.js";
import {QuestActionCraft} from "./action_craft.js";

// Quest
export class Quest {

    #quest_player;

    constructor(player, quest) {
        this.#quest_player = player;
        this.id             = quest.id;
        this.title          = quest.title;
        this.description    = quest.description;
        this.rewards        = JSON.parse(JSON.stringify(quest.rewards));
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

}