export class QuestManager {

    #world;

    constructor(world) {
        this.#world = world;
    }

    async init() {
        this.default_quests = await this.#world.db.quests.defaults();
    }

    getDefaultQuests() {
        return this.default_quests;
    }

    async savePlayerQuest(player, quest) {
        return await this.#world.db.quests.savePlayerQuest(player, quest);
    }

    async loadPlayerQuests(player) {
        return await this.#world.db.quests.loadPlayerQuests(player);
    }

    async questsUserStarted(player) {
        return await this.#world.db.quests.userStarted(player);
    }

    async loadQuest(quest_id) {
        return await this.#world.db.quests.load(quest_id);
    }

}