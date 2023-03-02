import { Vector, unixTime } from "../../www/src/helpers.js";
import { DropItem } from '../drop_item.js';
import { BulkSelectQuery, preprocessSQL, run } from './db_helpers.js';
import { INVENTORY_SLOT_COUNT, PLAYER_STATUS, WORLD_TYPE_BUILDING_SCHEMAS, WORLD_TYPE_NORMAL } from '../../www/src/constant.js';

// Database packages
import { DBWorldMob } from './world/mob.js';
import { DBWorldMigration } from './world/migration.js';
import { DBWorldQuest } from './world/quest.js';
import { DROP_LIFE_TIME_SECONDS } from "../../www/src/constant.js";
import { DBWorldPortal } from "./world/portal.js";
import { DBWorldFluid } from "./world/fluid.js";
import { DBWorldChunk } from "./world/chunk.js";
import { compressWorldModifyChunk } from "../../www/src/compress/world_modify_chunk.js";
import { WorldGenerators } from "../world/generators.js";
import type { ServerWorld } from "../server_world.js";
import type { ServerPlayer } from "../server_player.js";
import type { Indicators, PlayerState } from "../../www/src/player.js";
import { SAVE_BACKWARDS_COMPATIBLE_INDICATOTRS } from "../server_constant.js";

export type BulkDropItemsRow = [
    string,     // entity_id
    number,     // dt
    string,     // JSON.stringify(items)
    number, number, number  // x, y, z
]

export type PlyaerInitInfo = {
    state: PlayerState,
    inventory,
    status: PLAYER_STATUS
}

/** Old format of indictors, used in DB for backwards compatibility (for some time). */
export type DeprecatedIndicators = {
    [key: string]: {
        name: string
        value: number
    }
}

/** @returns a new object containing indicators in the old format */
export function toDeprecatedIndicators(indicators: Indicators): DeprecatedIndicators {
    const res = {}
    for(const key in indicators) {
        res[key] = { name: key, value: indicators[key] }
    }
    return res
}

/**
 * If the indicatrs are in the old format, changes them into the new format.
 * @param indicators - in/out paramter. If it's in the old format, it's changed by this metod.
 */
export function upgradeToNewIndicators(indicators: DeprecatedIndicators | Indicators): Indicators {
    if (typeof indicators.live === 'number') {
        return // it's already in the new format
    }
    for(const key in indicators) {
        indicators[key] = (indicators as DeprecatedIndicators)[key].value
    }
    return indicators as Indicators
}

export type PlayerUpdateRow = [
    user_id     : int,
    pos         : string,   // JSON.stringify(state.pos),
    rotate      : string,   // JSON.stringify(state.rotate),
    indicators  : string,   // JSON.stringify(state.indicators | toDeprecatedIndicators(state.indicators)),
    stats       : string,   // JSON.stringify(state.stats)
    state       : string    // JSON.stringify(state)
];

const INSERT = {
    BULK_DROP_ITEMS: undefined
}
const UPDATE = {
    BULK_DROP_ITEMS: undefined,
    BULK_INVENTORY: undefined,
    BULK_PLAYER_STATE: undefined
}

// World database provider
export class DBWorld {
    conn: DBConnection;
    world: ServerWorld;
    migrations: DBWorldMigration;
    mobs: DBWorldMob;
    quests: DBWorldQuest;
    portal: DBWorldPortal;
    fluid: DBWorldFluid;
    chunks: DBWorldChunk;
    bulkLoadDropItemsQuery: BulkSelectQuery;
    _defaultPlayerIndicators?: Indicators;

    constructor(conn: DBConnection, world : ServerWorld) {
        this.conn = conn;
        this.world = world;
    }

    /**
     * @returns {DBWorld}
     */
    async init() {
        this.migrations = new DBWorldMigration(this.conn, this.world, this.getDefaultPlayerStats, this.getDefaultPlayerIndicators);
        await this.migrations.apply();
        this.mobs = new DBWorldMob(this.conn, this.world);
        await this.mobs.init();
        this.quests = new DBWorldQuest(this.conn, this.world);
        await this.quests.init();
        this.portal = new DBWorldPortal(this.conn, this.world);
        this.fluid = new DBWorldFluid(this.conn, this.world);
        this.chunks = new DBWorldChunk(this.conn, this.world);

        this.bulkLoadDropItemsQuery = new BulkSelectQuery(this.conn,
            `WITH cte AS (SELECT key, value FROM json_each(:jsonRows))
            SELECT cte.key, drop_item.*
            FROM cte, drop_item
            WHERE x >= %0 AND x < %1 AND y >= %2 AND y < %3 AND z >= %4 AND z < %5 AND dt >= :death_date`,
            'key'
        );

        return this;
    }

    /**
     * Open database and return provider
     * @param {*} conn
     * @param {*} world
     * @returns {DBWorld}
     */
    static async openDB(conn: DBConnection, world: ServerWorld): Promise<DBWorld> {
        return await new DBWorld(conn, world).init();
    }

    /**
     * Возвращает мир по его GUID либо создает и возвращает его
     */
    async getWorld(world_guid : string) : Promise<TWorldInfo> {
        const row = await this.conn.get("SELECT * FROM world WHERE guid = ?", [world_guid]);
        if(row) {
            const resp = {
                id:             row.id,
                user_id:        row.user_id,
                dt:             row.dt,
                guid:           row.guid,
                title:          row.title,
                seed:           row.seed,
                ore_seed:       row.ore_seed,
                game_mode:      row.game_mode,
                generator:      JSON.parse(row.generator),
                pos_spawn:      JSON.parse(row.pos_spawn),
                rules:          JSON.parse(row.rules),
                state:          null,
                add_time:       row.add_time,
                world_type_id:  row.title == config.building_schemas_world_name ? WORLD_TYPE_BUILDING_SCHEMAS : WORLD_TYPE_NORMAL,
                recovery:       row.recovery
            } as TWorldInfo
            resp.generator = WorldGenerators.validateAndFixOptions(resp.generator);
            return resp;
        }
        // Insert new world to Db
        const world = await Qubatch.db.getWorld(world_guid);
        await this.conn.run('INSERT INTO world(dt, guid, user_id, title, seed, generator, pos_spawn, game_mode, ore_seed) VALUES (:dt, :guid, :user_id, :title, :seed, :generator, :pos_spawn, :game_mode, :ore_seed)', {
            ':dt':          unixTime(),
            ':guid':        world.guid,
            ':user_id':     world.user_id,
            ':title':       world.title,
            ':seed':        world.seed,
            ':ore_seed':    randomUUID(),
            ':generator':   JSON.stringify(world.generator),
            ':pos_spawn':   JSON.stringify(world.pos_spawn),
            ':game_mode':   world.game_mode
        });
        return this.getWorld(world_guid);
    }

    async updateAddTime(world_guid : string, add_time : int) {
        await this.conn.run('UPDATE world SET add_time = :add_time WHERE guid = :world_guid', {
            ':world_guid':  world_guid,
            ':add_time':    add_time
        });
    }

    async setWorldGameMode(world_guid, game_mode) {
        await this.conn.run('UPDATE world SET game_mode = :game_mode WHERE guid = :guid', {
            ':game_mode':   game_mode,
            ':guid':        world_guid
        });
    }

    async TransactionBegin() {
        await this.conn.get('begin transaction');
    }

    async TransactionCommit() {
        await this.conn.get('commit');
    }

    async TransactionRollback() {
        await this.conn.get('rollback');
    }

    async saveRecoveryBlob(blob) {
        return this.conn.run('UPDATE world SET recovery = ? WHERE id = ?', [blob, this.world.info.id]);
    }

    //
    async compressModifiers() {
        const p_start = performance.now()
        let chunks_count = 0;
        const rows = await this.conn.all('SELECT _rowid_ AS rowid, data FROM world_modify_chunks WHERE has_data_blob = 0', {});
        const all = []
        const processChunk = async (rowid, priv, pub, compress_time) => {
            return new Promise(async (resolve, reject) => {
                const p = performance.now()
                const result = await this.conn.run('UPDATE world_modify_chunks SET data_blob = :data_blob, private_data_blob = :private_data_blob, has_data_blob = 1 WHERE _rowid_ = :_rowid_', {
                    ':data_blob':           pub,
                    ':private_data_blob':   priv,
                    ':_rowid_':             rowid
                })
                const p1 = Math.round(compress_time * 1000) / 1000
                const p2 = Math.round((performance.now() - p) * 1000) / 1000
                console.log(`compressModifiers: upd times: compress: ${p1}, store: ${p2} ms`)
                resolve(result)
            })

        }
        for(let row of rows) {
            chunks_count++;
            const p = performance.now()
            const compressed = compressWorldModifyChunk(JSON.parse(row.data), true)
            // save compressed
            all.push(processChunk(row.rowid, compressed.private, compressed.public, performance.now() - p))
        }
        await Promise.all(all)
        console.log(`compressModifiers: chunks: ${chunks_count}, elapsed: ${Math.round((performance.now() - p_start) * 1000) / 1000} ms`)
        return true
    }

    /** @returns a new instance of {@link Indicators} filled with default values. */
    getDefaultPlayerIndicators(): Indicators {
        return {
            live: 20,
            food: 20,
            oxygen: 20
        }
    }

    // Return default inventory for user
    getDefaultInventory() {
        const MAX_INVERTORY_SLOT_COUNT = 42;
        const resp = {
            items: new Array(MAX_INVERTORY_SLOT_COUNT).fill(null),
            current: {
                index: 0, // right hand
                index2: -1 // left hand
            }
        };
        return resp;
    }

    // getDefaultPlayerStats...
    getDefaultPlayerStats() {
        return {death: 0, time: 0, pickat: 0, distance: 0}
    }

    // Register new player or returns existed
    async registerPlayer(world: ServerWorld, player: ServerPlayer): Promise<PlyaerInitInfo> {
        // Find existing user record
        const row = await this.conn.get("SELECT id, inventory, pos, pos_spawn, rotate, indicators, chunk_render_dist, game_mode, stats, state FROM user WHERE guid = ?", [player.session.user_guid]);
        if(row) {

            const fixInventory = (inventory) => {
                if(inventory.items.length < INVENTORY_SLOT_COUNT) {
                    inventory.items.push(...new Array(INVENTORY_SLOT_COUNT - inventory.items.length).fill(null));
                }
                // fix list of items
                for(let i in inventory.items) {
                    const item = inventory.items[i]
                    if(!item) continue
                    const mat = world.block_manager.fromId(item.id)
                    if(mat && item.count) {
                        // fix items count
                        if(item.count > mat.max_in_stack) {
                            item.count = mat.max_in_stack
                        }
                    } else {
                        // remove nonexistent items
                        inventory.items[i] = null
                    }
                }
                // Added new property
                if(inventory.current.index2 === undefined) {
                    inventory.current.index2 = -1;
                }
                return inventory
            }

            const inventory = fixInventory(JSON.parse(row.inventory))
            const state = row.state ? JSON.parse(row.state) : { }

            // TODO remove backwards compatibility with seprate fields
            Object.assign(state, {
                pos:                JSON.parse(row.pos),
                pos_spawn:          JSON.parse(row.pos_spawn),
                rotate:             JSON.parse(row.rotate),
                indicators:         upgradeToNewIndicators(JSON.parse(row.indicators)),
                chunk_render_dist:  row.chunk_render_dist,
                game_mode:          row.game_mode || world.info.game_mode,
                stats:              JSON.parse(row.stats)
            });

            // postprocess state
            state.pos       = new Vector(state.pos)
            state.pos_spawn = new Vector(state.pos_spawn)
            state.rotate    = new Vector(state.rotate)

            return {
                state: state,
                inventory: inventory,
                status: state.indicators.live ? PLAYER_STATUS.ALIVE : PLAYER_STATUS.DEAD
            };
        }
        const default_pos_spawn = world.info.pos_spawn;
        const defaultState = {
            pos         : default_pos_spawn,
            pos_spawn   : default_pos_spawn,
            rotate      : new Vector(0, 0, Math.PI),
            indicators  : this.getDefaultPlayerIndicators(),
            stats       : this.getDefaultPlayerStats()
        }
        const defaultIndicators: any = SAVE_BACKWARDS_COMPATIBLE_INDICATOTRS
            ? toDeprecatedIndicators(defaultState.indicators)
            : defaultState.indicators
        // Insert to DB
        await this.conn.run('INSERT INTO user(id, guid, username, dt, pos, pos_spawn, rotate, inventory, indicators, is_admin, stats, state) VALUES(:id, :guid, :username, :dt, :pos, :pos_spawn, :rotate, :inventory, :indicators, :is_admin, :stats, :state)', {
            ':id':          player.session.user_id,
            ':dt':          unixTime(),
            ':guid':        player.session.user_guid,
            ':username':    player.session.username,
            ':pos':         JSON.stringify(default_pos_spawn),
            ':pos_spawn':   JSON.stringify(default_pos_spawn),
            ':rotate':      JSON.stringify(defaultState.rotate),
            ':inventory':   JSON.stringify(this.getDefaultInventory()),
            ':indicators':  JSON.stringify(defaultIndicators),
            ':is_admin':    (world.info.user_id == player.session.user_id) ? 1 : 0,
            ':stats':       JSON.stringify(defaultState.stats),
            ':state':       JSON.stringify(defaultState)
        });
        const result = await this.registerPlayer(world, player);
        result.status = PLAYER_STATUS.WAITING_DATA;
        return result;
    }

    // Добавление сообщения в чат
    async insertChatMessage(player, params) {
        await this.conn.run('INSERT INTO chat_message(user_id, dt, text, world_id, user_session_id) VALUES (:user_id, :dt, :text, :world_id, :user_session_id)', {
            ':user_id':         player.session.user_id,
            ':dt':              unixTime(),
            ':text':            params.text,
            ':world_id':        this.world.info.id,
            ':user_session_id': 0
        });
    }

    async bulkUpdateInventory(rows: [userId: int, inventory: string][]) {
        UPDATE.BULK_INVENTORY = UPDATE.BULK_INVENTORY ?? preprocessSQL(`
            UPDATE user
            SET inventory = %1
            FROM json_each(?)
            WHERE user.id = %0
        `);
        return rows.length
            ? run(this.conn, UPDATE.BULK_INVENTORY, [JSON.stringify(rows)])
            : null;
    }

    static toPlayerUpdateRow(player: ServerPlayer): PlayerUpdateRow {
        const state = player.state;
        const indicators = SAVE_BACKWARDS_COMPATIBLE_INDICATOTRS
            ? toDeprecatedIndicators(state.indicators)
            : state.indicators
        return [
            player.session.user_id,
            JSON.stringify(state.pos),
            JSON.stringify(state.rotate),
            JSON.stringify(indicators),
            JSON.stringify(state.stats),
            JSON.stringify(state)
        ];
    }

    async bulkUpdatePlayerState(rows: PlayerUpdateRow[], dt: int) {
        UPDATE.BULK_PLAYER_STATE = UPDATE.BULK_PLAYER_STATE ?? preprocessSQL(`
            UPDATE user
            SET pos = %1, rotate = %2, indicators = %3, stats = %4, state = %5, dt_moved = :dt
            FROM json_each(:jsonRows)
            WHERE user.id = %0
        `);
        return rows.length ? run(this.conn, UPDATE.BULK_PLAYER_STATE, {
            ':jsonRows': JSON.stringify(rows),
            ':dt':  dt
        }) : null;
    }

    // changePosSpawn...
    async changePosSpawn(player, params) {
        await this.conn.run('UPDATE user SET pos_spawn = :pos_spawn WHERE id = :id', {
            ':id':             player.session.user_id,
            ':pos_spawn':      JSON.stringify(params.pos)
        });
    }

    // Change render dist
    async changeRenderDist(player, value) {
        await this.conn.run('UPDATE user SET chunk_render_dist = :chunk_render_dist WHERE id = :id', {
            ':id':                  player.session.user_id,
            ':chunk_render_dist':   value
        });
    }

    // Return admin list
    async loadAdminList(world_id)  {
        const resp = [];
        const rows = await this.conn.all('SELECT username FROM user WHERE is_admin = ?', [world_id]);
        for(let row of rows) {
            resp.push(row.username);
        }
        return resp;
    }

    // findPlayer...
    async findPlayer(world_id, username : string) {
        const row = await this.conn.get("SELECT id, username FROM user WHERE username = ?", [username]);
        if(!row) {
            return null;
        }
        return row;
    }

    // setAdmin...
    async setAdmin(world_id, user_id, is_admin) {
        await this.conn.get("UPDATE user SET is_admin = ? WHERE id = ?", [is_admin, user_id]);
    }

    async bulkInsertDropItems(rows: BulkDropItemsRow[]) {
        INSERT.BULK_DROP_ITEMS = INSERT.BULK_DROP_ITEMS ?? preprocessSQL(`
            INSERT INTO drop_item (entity_id, dt, items, x, y, z)
            SELECT %0, %1, %2, %3, %4, %5
            FROM json_each(:jsonRows)
        `);
        return rows.length ? run(this.conn, INSERT.BULK_DROP_ITEMS, {
            ':jsonRows': JSON.stringify(rows)
        }) : null;
    }

    async bulkUpdateDropItems(rows: BulkDropItemsRow[]) {
        UPDATE.BULK_DROP_ITEMS = UPDATE.BULK_DROP_ITEMS ?? preprocessSQL(`
            UPDATE drop_item
            SET dt = %1, items = %2, x = %3, y = %4, z = %5
            FROM json_each(:jsonRows)
            WHERE entity_id = %0
        `);
        return rows.length ? run(this.conn, UPDATE.BULK_DROP_ITEMS, {
            ':jsonRows': JSON.stringify(rows)
        }) : null;
    }

    async bulkDeleteDropItems(entityIds) {
        return entityIds.length ? run(this.conn,
            'DELETE FROM drop_item WHERE entity_id IN (SELECT value FROM json_each(?))',
            [JSON.stringify(entityIds)]
        ) : null;
    }

    // Delete all old drop items
    async removeDeadDrops() {
        await this.conn.run('DELETE FROM drop_item WHERE dt < :dt', {
            ':dt': ~~(unixTime() - DROP_LIFE_TIME_SECONDS)
        });
    }

    /**
     * Loads drop items in a given volume.
     * @param coord the lower corner
     * @param size
     * @returns items by entity_id
     */
    async loadDropItems(coord : Vector, size : Vector) : Promise<Map<string, DropItem>> {
        const rows = await this.bulkLoadDropItemsQuery.all([
            coord.x,
            coord.x + size.x,
            coord.y,
            coord.y + size.y,
            coord.z,
            coord.z + size.z
        ]);
        const resp = new Map();
        for(let row of rows) {
            const item = new DropItem(this.world, {
                dt:         row.dt,
                id:         row.id,
                pos:        new Vector(row.x, row.y, row.z),
                entity_id:  row.entity_id,
                items:      JSON.parse(row.items)
            }, null, false);
            resp.set(item.entity_id, item);
        }
        return resp;
    }

    // Change player game mode
    async changeGameMode(player, game_mode : string) {
        return await this.conn.run('UPDATE user SET game_mode = :game_mode WHERE id = :id', {
            ':id':              player.session.user_id,
            ':game_mode':       game_mode
        });
    }

    /**
     * TO DO EN список точек для телепортации
     * @param {number} id id игрока
     * @return { object } список доступных точек для телепортации
     */
    async getListTeleportPoints(id : number) {
        const rows = await this.conn.all("SELECT title, x, y, z FROM teleport_points WHERE user_id = :id ", {
            ":id" : id
        });
        if(!rows) {
            return null;
        }
        return rows;
    }

    /**
     * TO DO EN получает коодинаты точки игрока с именем title
     * @param id id игрока
     * @param title имя точки
     */
    async getTeleportPoint(id : number, title : string) {
        const clear_title = title.replace(/[^a-z0-9\s]/gi, '').substring(0, 50);
        const row = await this.conn.get("SELECT x, y, z FROM teleport_points WHERE user_id = :id AND title = :title", {
            ":id" : id,
            ":title": clear_title
        });
        if(!row) {
            return null;
        }
        return row;
    }

    /**
     * TO DO EN добавляет положение игрока в список с именем title
     * @param user_id id игрока
     * @param title имя точки
     * @param x x точки
     * @param y y точки
     * @param z z точки
     */
    async addTeleportPoint(user_id : number, title : string, x : number, y : number, z : number) {
        const clear_title = title.replace(/[^a-z0-9\s]/gi, '').substring(0, 50);
        await this.conn.run("INSERT INTO teleport_points(user_id, title, x, y, z) VALUES (:user_id, :title, :x, :y, :z)", {
            ":user_id": user_id,
            ":title":   clear_title,
            ":x":       x,
            ":y":       y + 0.5,
            ":z":       z
        });
    }

    //
    async saveGameRules(world_guid : string, rules) {
        await this.conn.run('UPDATE world SET rules = :rules WHERE guid = :world_guid', {
            ':world_guid':  world_guid,
            ':rules':    JSON.stringify(rules)
        });
    }

    //
    async setWorldSpawn(world_guid : string, pos_spawn : Vector) {
        await this.conn.run('UPDATE world SET pos_spawn = :pos_spawn WHERE guid = :world_guid', {
            ':world_guid':  world_guid,
            ':pos_spawn':   JSON.stringify(pos_spawn)
        });
    }

    // Save ender chest content
    async saveEnderChest(player, ender_chest) {
        await run(this.conn, 'UPDATE user SET ender_chest = :ender_chest WHERE id = :id', {
            ':id':            player.session.user_id,
            ':ender_chest':   JSON.stringify(ender_chest)
        });
    }

    // Return ender chest content
    async loadEnderChest(player)  {
        const rows = await this.conn.all('SELECT ender_chest FROM user WHERE id = :id', {
            ':id': player.session.user_id
        });
        for(let row of rows) {
            return JSON.parse(row.ender_chest);
        }
        return null;
    }

    async setTitle(title : string)  {
        await this.conn.run('UPDATE world SET title = ?', [title]);
    }

    async flushWorld() {
        await this.TransactionBegin()
        try {
            for(let tablename of ['user_quest', 'world_chunks_fluid', 'world_modify', 'world_modify_chunks', 'drop_item', 'entity', 'painting', 'portal', 'teleport_points', 'chunk']) {
                this.conn.run(`DELETE FROM ${tablename}`);
            }
            this.conn.run('UPDATE world SET dt = :dt, add_time = :add_time', {':dt': unixTime(), ':add_time': 12000})
            await this.TransactionCommit()
        } catch(e) {
            await this.TransactionRollback()
            throw e;
        }
    }

    flushBulkSelectQueries() {
        this.bulkLoadDropItemsQuery.flush({
            ':death_date': unixTime() - DROP_LIFE_TIME_SECONDS
        });
        this.chunks.bulkGetWorldModifyChunkQuery.flush();
        this.chunks.bulkGetChunkQuery.flush();
        this.fluid.bulkGetQuery.flush();
        this.mobs.bulkLoadActiveInVolumeQuery.flush();
    }

}