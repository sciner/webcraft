// QuestActionBase
export class QuestActionBase {
    
    #quest;

    constructor(quest, params) {
        this.#quest = quest;
        for(let k in params) {
            this[k] = params[k];
        }
        if(!('value' in this)) {
            this.value = null;
        }
        this.update();
    }

    async checkAndMarkDirty() {
        return this.#quest.checkAndMarkDirty();
    }

    update() {
        this.ok = false;
        this.in_progress = false;
    }

    // processTriggerEvent...
    async processTriggerEvent(quest, e) {
        // need to process player game event
    }

}