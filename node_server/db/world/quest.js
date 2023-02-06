import { preprocessSQL, run } from "../db_helpers.js";

const INSERT = {}
const UPDATE = {}

export class DBWorldQuest {

    constructor(conn, world) {
        this.conn = conn;
        this.world = world;
    }

    /**
     * @return {Object} - one quest with actions and rewards {
     *  id              Int
     *  quest_group_id  Int
     *  title           String
     *  description     ?String
     *  next_quests     ?String
     *  actions         Array of { id, quest_action_type_id, block_id, cnt, pos, description }
     *  rewards         Array of { id, block_id, cnt }
     * }
     * Not included:
     *  is_default      Int
     */
    async load(quest_id) {
        // Quests
        let quest = null;
        // const quests = new Map();
        let rows = await this.conn.all('SELECT id, quest_group_id, title, description, next_quests FROM quest WHERE id = :quest_id', {
            ':quest_id': quest_id
        });
        for(let row of rows) {
            quest = {...row, actions: [], rewards: []};
            // quests.set(quest.id, quest);
        }
        if(!quest) {
            return quest;
        }
        // Actions
        rows = await this.conn.all('SELECT * FROM quest_action WHERE quest_id = :quest_id', {
            ':quest_id': quest_id
        });
        for(let row of rows) {
            const action = {...row};
            delete(action.quest_id);
            quest.actions.push(action);
        }
        // Rewards
        rows = await this.conn.all('SELECT * FROM quest_reward WHERE quest_id = :quest_id', {
            ':quest_id': quest_id
        });
        for(let row of rows) {
            const reward = {...row};
            delete(reward.quest_id);
            quest.rewards.push(reward);
        }
        return quest;
    }

    /**
     * @return {Map of Object} all quest groups, each containing a subset of its quests with (default == 1).
     * Keys = group ids
     * Values: {
     *  id      Int
     *  title   String
     *  quests  Array of the same data as returned by {@link load}
     * }
     */
    async getGroupsWithDefaultQuests() {
        // Groups
        const groups = new Map();
        const group_rows = await this.conn.all('SELECT * FROM quest_group', {});
        for(let row of group_rows) {
            const g = {...row, quests: []};
            groups.set(g.id, g);
        }
        // Quests
        const quests = new Map();
        let rows = await this.conn.all('SELECT id, quest_group_id, title, description, next_quests FROM quest WHERE is_default = 1', {});
        for(let row of rows) {
            const quest = {...row, actions: [], rewards: []};
            let g = groups.get(row.quest_group_id);
            g.quests.push(quest);
            quests.set(quest.id, quest);
        }
        // Actions
        rows = await this.conn.all('SELECT * FROM quest_action WHERE quest_id IN(SELECT id FROM quest WHERE is_default = 1)', {});
        for(let row of rows) {
            const action = {...row};
            delete(action.quest_id);
            let q = quests.get(row.quest_id);
            q.actions.push(action);
        }
        // Rewards
        rows = await this.conn.all('SELECT quest_id, block_id, cnt FROM quest_reward WHERE quest_id IN(SELECT id FROM quest WHERE is_default = 1)', {});
        for(let row of rows) {
            const reward = {...row};
            delete(reward.quest_id);
            let q = quests.get(row.quest_id);
            q.rewards.push(reward);
        }
        return groups;
    }

    // loadPlayerQuests...
    async loadPlayerQuests(player) {
        if(player.world.isBuildingWorld()) {
            return []
        }
        const rows = await this.conn.all(`SELECT
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
        for(let row of rows) {
            row.actions         = JSON.parse(row.actions);
            row.quest_group     = JSON.parse(row.quest_group);
            row.rewards         = JSON.parse(row.rewards);
            row.is_completed    = row.is_completed != 0;
            row.in_progress     = row.in_progress != 0;
        }
        return rows;
    }

    /** @return a row that can be passed to {@link bulkInsertPlayerQuests} or {@link bulkUpdatePlayerQuests} */
    static playerQuestToRow(player, quest) {
        return [
            player.session.user_id,
            quest.id,
            quest.is_completed ? 1 : 0,
            quest.db_in_progress ? 1 : 0,
            JSON.stringify(quest.actions)
        ];
    }

    /** 
     * @param {Array of Array} rows - the results of {@link playerQuestToRow}
     * @param {Int} dt - unix time
    */
    async bulkInsertPlayerQuests(rows, dt) {
        INSERT.BULK_PLAYER_QUESTS = INSERT.BULK_PLAYER_QUESTS ?? preprocessSQL(`
            INSERT INTO user_quest (
                dt, user_id, quest_id,
                is_completed, in_progress, actions
            ) SELECT
                :dt, %0, %1,
                %2, %3, %4
            FROM json_each(:jsonRows)
        `);
        return rows.length ? run(this.conn, INSERT.BULK_PLAYER_QUESTS, {
            ':jsonRows': JSON.stringify(rows),
            ':dt': dt
        }) : null;
    }

    /** @param {Array of Array} rows - the results of {@link playerQuestToRow} */
    async bulkUpdatePlayerQuests(rows) {
        UPDATE.BULK_PLAYER_QUESTS = UPDATE.BULK_PLAYER_QUESTS ?? preprocessSQL(`
            UPDATE user_quest
            SET is_completed = %2, in_progress = %3, actions = %4
            FROM json_each(:jsonRows)
            WHERE user_id = %0 AND quest_id = %1
        `);
        return rows.length ? run(this.conn, UPDATE.BULK_PLAYER_QUESTS, {
            ':jsonRows': JSON.stringify(rows)
        }) : null;
    }

}