import {QuestActionBase} from "./action_base.js";
import type {ServerPlayer} from "../server_player.js";

// QuestActionPickup
export class QuestActionPickup extends QuestActionBase {
    cnt: int;

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
        const player: ServerPlayer = e.player
        // pickup events have "items", inventory events - "item"
        const items = e.data.items || [e.data.item];
        for(let item of items) {
            // items in pickup events have "id", in inventory events - "block_id"
            const item_id = item.id ?? item.block_id;
            if (this.blockIdMatches(item_id)) {
                // посчитать сколько всего подходящих предметов есть в инвентаре
                let hasCount = 0
                for(let item of player.inventory.items) {
                    if (item && this.blockIdMatches(item.id)) {
                        hasCount += item.count
                    }
                }

                this.value = Math.max(this.value | 0, hasCount);
                this.update();
                console.log(`Action changed: ${quest.title} ${this.value}/${this.cnt} ... ${this.ok}`);
                this.checkAndMarkDirty();
            }
        }
    }

}