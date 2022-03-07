import {QuestActionBase} from "./action_base.js";

// QuestActionSetBlock
export class QuestActionSetBlock extends QuestActionBase {

    constructor(quest, params) {
        super(quest, params);
        if(!('value' in this)) {
            this.value = 0;
        }
    }

}