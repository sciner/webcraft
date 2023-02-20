// QuestGroup
export class QuestGroup {
    id: any;
    title: string;
    quests: any[];

    constructor(params) {
        this.id = params.id;
        this.title = params.title;
        this.quests = [];
    }

    addQuest(quest) {
        this.quests.push(quest);
    }

}