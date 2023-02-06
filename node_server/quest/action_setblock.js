import {QuestActionBase} from "./action_base.js";

// QuestActionSetBlock
export class QuestActionSetBlock extends QuestActionBase {

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
        const item = {
            id: e.data.block.id,
            count: 1
        };
        console.log(this.block_id, item)
        if(item.id == this.block_id) {
            this.value = (this.value | 0) + item.count;
            this.update();
            console.log(`Action changed: ${quest.title} ${this.value}/${this.cnt} ... ${this.ok}`);
            this.checkAndMarkDirty();
        }
    }

}