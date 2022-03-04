export class QuestManager {

    #world;

    constructor(world) {
        this.#world = world;
        this.init();
    }

    async init() {
        this.groups = await this.#world.db.loadQuests();
    }

    getEnabled(player) {
        return this.groups;
    }

}