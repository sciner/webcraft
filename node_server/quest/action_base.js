// QuestActionBase
export class QuestActionBase {
    
    #quest;

    constructor(quest, params) {
        this.#quest = quest;
        for(let k in params) {
            this[k] = params[k];
        }
    }

}