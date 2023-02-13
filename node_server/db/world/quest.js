import { preprocessSQL, run } from '../db_helpers.js';

const INSERT = {};
const UPDATE = {};

export class DBWorldQuest {
    constructor(conn, world) {
        this.conn = conn;
        this.world = world;
    }

    async init() {
        // Groups
        const groups = new Map();
        const defaultGroups = new Map();
        const groupRows = await this.conn.all('SELECT * FROM quest_group');
        for (let row of groupRows) {
            groups.set(row.id, { ...row, quests: [] });
            defaultGroups.set(row.id, { ...row, quests: [] });
        }

        // Quests
        const quests = new Map();
        const questRows = await this.conn.all(
            'SELECT id, quest_group_id, title, description, next_quests, is_default FROM quest',
        );
        for (let row of questRows) {
            const quest = { ...row, actions: [], rewards: [] };
            const group = groups.get(row.quest_group_id);
            group.quests.push(quest);
            quests.set(quest.id, quest);

            if (quest.is_default) {
                const defaultGroup = defaultGroups.get(row.quest_group_id);
                defaultGroup.quests.push(quest);
            }
        }

        // Actions
        const actionsRows = await this.conn.all('SELECT * FROM quest_action');
        for (let action of actionsRows) {
            const quest = quests.get(action.quest_id);
            delete action.quest_id;
            quest.actions.push({ ...action });
        }

        // Rewards
        const rewardsRows = await this.conn.all(
            'SELECT quest_id, block_id, cnt FROM quest_reward',
        );
        for (let reward of rewardsRows) {
            const quest = quests.get(reward.quest_id);
            delete reward.quest_id;
            quest.rewards.push({ ...reward });
        }

        this.groups = groups;
        this.defaultGroups = defaultGroups;
        this.quests = quests;
    }

    /**
     * @return { object } - one quest with actions and rewards {
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
    load(quest_id) {
        return this.quests.get(quest_id);
    }

    /**
     * @type {Map<string, object>} all quest groups, each containing a subset of its quests (where is_default = 1).
     * Keys = group ids
     * Values: {
     *  id      Int
     *  title   String
     *  quests  Array of the same data as returned by {@link load}
     * }
     */
    getGroupsWithDefaultQuests() {
        return this.defaultGroups;
    }

    /**
     * @param { import("../../server_player.js").ServerPlayer } player
     * @returns
     */
    async loadPlayerQuests(player) {
        if (player.world.isBuildingWorld()) {
            return [];
        }

        const rows = await this.conn.all(
            `SELECT
                quest_id,
                actions,
                is_completed,
                in_progress
            FROM user_quest
            WHERE user_id = :user_id`,
            {
                ':user_id': player.session.user_id,
            },
        );

        const quests = [];
        for (let row of rows) {
            const quest = this.quests.get(row.quest_id);

            quests.push({
                id: row.quest_id,
                quest_group_id: quest.quest_group_id,
                quest_group: this.groups.get(quest.quest_group_id),
                title: quest.title,
                description: quest.description,
                next_quests: quest.next_quests,
                is_completed: !!row.is_completed,
                in_progress: !!row.in_progress,
                actions: JSON.parse(row.actions),
                rewards: quest.rewards,
            });
        }

        return quests;
    }

    /** @return a row that can be passed to {@link bulkInsertPlayerQuests} or {@link bulkUpdatePlayerQuests} */
    static playerQuestToRow(player, quest) {
        return [
            player.session.user_id,
            quest.id,
            quest.is_completed ? 1 : 0,
            quest.db_in_progress ? 1 : 0,
            JSON.stringify(quest.actions),
        ];
    }

    /**
     * @param {Array of Array} rows - the results of {@link playerQuestToRow}
     * @param { int } dt - unix time
     */
    async bulkInsertPlayerQuests(rows, dt) {
        return rows.length
            ? run(this.conn, this.BULK_INSERT_PLAYER_QUESTS, {
                  ':jsonRows': JSON.stringify(rows),
                  ':dt': dt,
              })
            : null;
    }
    BULK_INSERT_PLAYER_QUESTS = preprocessSQL(`
        INSERT INTO user_quest (
            dt, user_id, quest_id,
            is_completed, in_progress, actions
        ) SELECT
            :dt, %0, %1,
            %2, %3, %4
        FROM json_each(:jsonRows)
    `);

    /** @param {Array of Array} rows - the results of {@link playerQuestToRow} */
    async bulkUpdatePlayerQuests(rows) {
        return rows.length
            ? run(this.conn, this.BULK_UPDATE_PLAYER_QUESTS, {
                  ':jsonRows': JSON.stringify(rows),
              })
            : null;
    }
    BULK_UPDATE_PLAYER_QUESTS = preprocessSQL(`
        UPDATE user_quest
        SET is_completed = %2, in_progress = %3, actions = %4
        FROM json_each(:jsonRows)
        WHERE user_id = %0 AND quest_id = %1
    `);
}
