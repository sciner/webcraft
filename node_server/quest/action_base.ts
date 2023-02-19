// QuestActionBase
export class QuestActionBase {
    
    #quest;
    value: any;
    ok: boolean;
    in_progress: boolean;

    constructor(quest, params) {
        this.#quest = quest;
        this.value = null;
        Object.assign(this, params);
        this.update();
    }

    checkAndMarkDirty() {
        return this.#quest.checkAndMarkDirty();
    }

    update() {
        this.ok = false;
        this.in_progress = false;
    }

    // processTriggerEvent...
    processTriggerEvent(quest, e) {
        // need to process player game event
    }

}