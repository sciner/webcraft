// QuestActionBase
export class QuestActionBase {
    
    #quest;

    constructor(quest, params) {
        this.#quest = quest;
        this.value = null;
        Object.assign(this, params);
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