export class QuestPlayer {

    constructor(quest_manager, player) {
        this.quest_manager = quest_manager;
        this.player = player;
        this.init();
    }

    init() {
        const groups = this.quest_manager.getEnabled();
        // PlayerEvent.addHandler(this.player)
    }

    getEnabled() {
        let resp = JSON.parse(JSON.stringify(this.quest_manager.getEnabled()));
        // const user_id = player.session.user_id;
        // console.log(user_id);
        return resp;
    }

}