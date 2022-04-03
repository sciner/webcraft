import {QuestActionBase} from "./action_base.js";

// QuestActionPickup
export class QuestActionPickup extends QuestActionBase {

    constructor(quest, params) {
        super(quest, params);
        this.value |= 0;
    }

    update() {
        this.ok = this.value >= this.cnt;
        this.in_progress = this.value > 0;
    }

    // processTriggerEvent...
    async processTriggerEvent(quest, e) {
        for(let item of e.data.items) {
            if(item.id == this.block_id) {
                this.value = (this.value | 0) + item.count;
                this.update();
                console.log(`Action changed: ${quest.title} ${this.value}/${this.cnt} ... ${this.ok}`);
                await this.save();
            }
        }
    }

}