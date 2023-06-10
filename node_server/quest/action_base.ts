// QuestActionBase
import type {Quest} from "./quest.js";
import type {BLOCK} from "@client/blocks.js";

export class QuestActionBase {

    #quest: Quest
    #block_manager: typeof BLOCK
    value: any = null
    ok: boolean;
    in_progress: boolean;
    quest_action_type_id: int

    // для квестов, связанных с типом блока
    block_id?: int              // если определено - подойдет этот конкретный блок
    block_suffixes?: string[]   // если определено - подойдет блок с любым из указанных суффиксов

    constructor(quest: Quest, params) {
        this.#quest = quest;
        this.#block_manager = quest.getPlayer().world.block_manager
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

    /** @return true если id указанного блока соотвевтсвует описанию квеста */
    protected blockIdMatches(id: int): boolean {
        if (id === this.block_id) {
            return true
        }
        if (this.block_suffixes) {
            const name = this.#block_manager.fromId(id).name
            return this.block_suffixes.some(suffix => name.endsWith(suffix))
        }
        return false
    }

}