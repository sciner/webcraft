export class QuestManager {

    #world;

    constructor(world) {
        this.#world = world;
    }

    async init() {
        this.default_quests = await this.#world.db.loadDefaultQuests();
    }

    getDefaultQuests() {
        return this.default_quests;
    }

    async savePlayerQuest(player, quest) {
        return await this.#world.db.savePlayerQuest(player, quest);
    }

    async loadPlayerQuests(player) {
        return await this.#world.db.loadPlayerQuests(player);
    }

    async questsUserStarted(player) {
        return await this.#world.db.questsUserStarted(player);
    }

    async loadQuest(quest_id) {
        return await this.#world.db.loadQuest(quest_id);
    }

}