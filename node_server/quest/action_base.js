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

    save() {
        return this.#quest.checkAndSave();
    }

    update() {
        this.ok = false;
    }

    // processTriggerEvent...
    processTriggerEvent(quest, e) {
        // need to process player game event
    }

}