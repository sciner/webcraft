import {QuestActionBase} from "./action_base.js";

// QuestActionPickup
export class QuestActionPickup extends QuestActionBase {

    constructor(quest, params) {
        super(quest, params);
        if(!('value' in this)) {
            this.value = 0;
        }
    }

}