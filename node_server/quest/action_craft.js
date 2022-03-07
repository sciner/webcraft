import {QuestActionBase} from "./action_base.js";

// QuestActionCraft
export class QuestActionCraft extends QuestActionBase {

    constructor(quest, params) {
        super(quest, params);
        if(!('value' in this)) {
            this.value = 0;
        }
    }

}