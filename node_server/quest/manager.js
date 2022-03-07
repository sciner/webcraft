export class QuestManager {

    #world;

    constructor(world) {
        this.#world = world;
    }

    async init() {
        this.groups = await this.#world.db.loadQuests();
    }

    getEnabled() {
        return this.groups;
    }

}