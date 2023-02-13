import { QuestActionBase } from './action_base.js';

// QuestActionCraft
export class QuestActionCraft extends QuestActionBase {
    constructor(quest, params) {
        super(quest, params);
        this.value |= 0;
    }

    update() {
        this.ok = this.value >= this.cnt;
        this.in_progress = this.value > 0;
    }

    // processTriggerEvent...
    processTriggerEvent(quest, e) {
        const item = e.data.item;
        if (item.block_id == this.block_id) {
            this.value = (this.value | 0) + item.count;
            this.update();
            console.log(
                `Action changed: ${quest.title} ${this.value}/${this.cnt} ... ${this.ok}`,
            );
            this.checkAndMarkDirty();
        }
    }
}
