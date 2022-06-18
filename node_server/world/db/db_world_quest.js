export class DBWorldQuest {

    constructor(db, world) {
        this.db = db;
        this.world = world;
    }

    //
    async load(quest_id) {
        // Quests
        let quest = null;
        // const quests = new Map();
        let rows = await this.db.all('SELECT id, quest_group_id, title, description FROM quest WHERE id = :quest_id', {
            ':quest_id': quest_id
        });
        for(let row of rows) {
            quest = {...row, actions: [], rewards: []};
            delete(quest.quest_group_id);
            // quests.set(quest.id, quest);
        }
        if(!quest) {
            return quest;
        }
        // Actions
        rows = await this.db.all('SELECT * FROM quest_action WHERE quest_id = :quest_id', {
            ':quest_id': quest_id
        });
        for(let row of rows) {
            const action = {...row};
            delete(action.quest_id);
            quest.actions.push(action);
        }
        // Rewards
        rows = await this.db.all('SELECT * FROM quest_reward WHERE quest_id = :quest_id', {
            ':quest_id': quest_id
        });
        for(let row of rows) {
            const reward = {...row};
            delete(reward.quest_id);
            quest.rewards.push(reward);
        }
        return quest;
    }

    // Return default quests with groups
    async defaults() {
        // Groups
        const groups = new Map();
        const group_rows = await this.db.all('SELECT * FROM quest_group', {});
        for(let row of group_rows) {
            const g = {...row, quests: []};
            groups.set(g.id, g);
        }
        // Quests
        const quests = new Map();
        let rows = await this.db.all('SELECT id, quest_group_id, title, description FROM quest WHERE is_default = 1', {});
        for(let row of rows) {
            const quest = {...row, actions: [], rewards: []};
            delete(quest.quest_group_id);
            let g = groups.get(row.quest_group_id);
            g.quests.push(quest);
            quests.set(quest.id, quest);
        }
        // Actions
        rows = await this.db.all('SELECT * FROM quest_action WHERE quest_id IN(SELECT id FROM quest WHERE is_default = 1)', {});
        for(let row of rows) {
            const action = {...row};
            delete(action.quest_id);
            let q = quests.get(row.quest_id);
            q.actions.push(action);
        }
        // Rewards
        rows = await this.db.all('SELECT * FROM quest_reward WHERE quest_id IN(SELECT id FROM quest WHERE is_default = 1)', {});
        for(let row of rows) {
            const reward = {...row};
            delete(reward.quest_id);
            let q = quests.get(row.quest_id);
            q.rewards.push(reward);
        }
        return Array.from(groups.values());
    }

    // userStarted...
    async userStarted(player) {
        let row = await this.db.get("SELECT * FROM user_quest WHERE user_id = :user_id", {
            ':user_id': player.session.user_id
        });
        if(!row) {
            return false;
        }
        return true;
    }

    // loadPlayerQuests...
    async loadPlayerQuests(player) {
        let rows = await this.db.all(`SELECT
                q.id,
                q.quest_group_id,
                q.title,
                q.description,
                q.next_quests,
                uq.is_completed,
                uq.in_progress,
                uq.actions,
                json_object('id', g.id, 'title', g.title) AS quest_group,
                (SELECT json_group_array(json_object('block_id', block_id, 'cnt', cnt)) FROM quest_reward qr WHERE qr.quest_id = q.id) AS rewards
            FROM user_quest uq
            left join quest q on q.id = uq.quest_id
            left join quest_group g on g.id = q.quest_group_id
            WHERE user_id = :user_id`, {
            ':user_id': player.session.user_id,
        });
        const resp = [];
        for(let row of rows) {
            row.actions         = JSON.parse(row.actions);
            row.quest_group     = JSON.parse(row.quest_group);
            row.rewards         = JSON.parse(row.rewards);
            row.is_completed    = row.is_completed != 0;
            row.in_progress     = !row.is_completed && row.in_progress != 0;
            resp.push(row);
        }
        return resp;
    }

    // savePlayerQuest...
    async savePlayerQuest(player, quest) {
        const exist_row = await this.db.get('SELECT * FROM user_quest WHERE user_id = :user_id AND quest_id = :quest_id', {
            ':user_id':             player.session.user_id,
            ':quest_id':            quest.id
        });
        if(exist_row) {
            await this.db.run('UPDATE user_quest SET actions = :actions, is_completed = :is_completed, in_progress = :in_progress WHERE user_id = :user_id AND quest_id = :quest_id', {
                ':user_id':         player.session.user_id,
                ':quest_id':        quest.id,
                ':is_completed':    quest.is_completed ? 1 : 0,
                ':in_progress':     quest.in_progress ? 1 : 0,
                ':actions':         JSON.stringify(quest.actions)
            });
        } else {
            await this.db.run('INSERT INTO user_quest(dt, user_id, quest_id, is_completed, in_progress, actions) VALUES (:dt, :user_id, :quest_id, :is_completed, :in_progress, :actions)', {
                ':dt':              ~~(Date.now() / 1000),
                ':user_id':         player.session.user_id,
                ':quest_id':        quest.id,
                ':is_completed':    quest.is_completed ? 1 : 0,
                ':in_progress':     quest.in_progress ? 1 : 0,
                ':actions':         JSON.stringify(quest.actions)
            });
        }
    }

}