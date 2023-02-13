// QuestGroup
export class QuestGroup {
    constructor(params) {
        this.id = params.id;
        this.title = params.title;
        this.quests = [];
    }

    addQuest(quest) {
        this.quests.push(quest);
    }
}
