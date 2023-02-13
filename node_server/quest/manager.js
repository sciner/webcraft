export class QuestManager {
    /**
     * @type { import("../server_world.js").ServerWorld }
     */
    #world;

    constructor(world) {
        this.#world = world;
    }

    init() {
        this.groupsWithDefaultQuestsById =
            this.#world.db.quests.getGroupsWithDefaultQuests();
        this.groupsWithDefaultQuestsList = Array.from(
            this.groupsWithDefaultQuestsById.values(),
        );
    }

    getGroupsWithDefaultQuests() {
        return this.groupsWithDefaultQuestsList;
    }

    getGroup(groupId) {
        return this.groupsWithDefaultQuestsById.get(groupId);
    }

    /**
     * @param {*} player of player quests
     * @returns {[]}
     */
    async loadPlayerQuests(player) {
        return await this.#world.db.quests.loadPlayerQuests(player);
    }

    loadQuest(quest_id) {
        return this.#world.db.quests.load(quest_id);
    }
}
