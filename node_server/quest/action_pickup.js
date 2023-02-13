import { QuestActionBase } from './action_base.js';

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
    processTriggerEvent(quest, e) {
        // pickup events have "items", inventory events - "item"
        const items = e.data.items || [e.data.item];
        for (let item of items) {
            // items in pickup events have "id", in inventory events - "block_id"
            const item_id = item.id ?? item.block_id;
            if (item_id == this.block_id) {
                const hasCount = e.player.inventory.countItemId(item_id);
                this.value = Math.max(this.value | 0, hasCount);
                this.update();
                console.log(
                    `Action changed: ${quest.title} ${this.value}/${this.cnt} ... ${this.ok}`,
                );
                this.checkAndMarkDirty();
            }
        }
    }
}
