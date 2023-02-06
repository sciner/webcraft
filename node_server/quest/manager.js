export class QuestManager {

    #world;

    constructor(world) {
        this.#world = world;
    }

    async init() {
        this.groupsWithDefaultQuestsById = this.#world.db.quests.getGroupsWithDefaultQuests();
        this.groupsWithDefaultQuestsList = Array.from(this.groupsWithDefaultQuestsById.values());
    }

    getGroupsWithDefaultQuests() {
        return this.groupsWithDefaultQuestsList;
    }

    getGroup(groupId) {
        return this.groupsWithDefaultQuestsById.get(groupId);
    }

    /** @return {Array} of player quests */
    async loadPlayerQuests(player) {
        return await this.#world.db.quests.loadPlayerQuests(player);
    }

    loadQuest(quest_id) {
        return this.#world.db.quests.load(quest_id);
    }

}