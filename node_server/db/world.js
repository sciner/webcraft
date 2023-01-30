import { Vector, unixTime } from "../../www/js/helpers.js";
import { DropItem } from '../drop_item.js';
import { BulkSelectQuery, preprocessSQL, run } from './db_helpers.js';
import { INVENTORY_SLOT_COUNT, WORLD_TYPE_BUILDING_SCHEMAS, WORLD_TYPE_NORMAL, PLAYER_STATUS_ALIVE, PLAYER_STATUS_DEAD, PLAYER_STATUS_WAITING_DATA } from '../../www/js/constant.js';

// Database packages
import { DBWorldMob } from './world/mob.js';
import { DBWorldMigration } from './world/migration.js';
import { DBWorldQuest } from './world/quest.js';
import { DROP_LIFE_TIME_SECONDS } from "../../www/js/constant.js";
import { DBWorldPortal } from "./world/portal.js";
import { DBWorldFluid } from "./world/fluid.js";
import { DBWorldChunk } from "./world/chunk.js";
import { compressWorldModifyChunk } from "../../www/js/compress/world_modify_chunk.js";
import { WorldGenerators } from "../world/generators.js";

// World database provider
export class DBWorld {

    constructor(conn, world) {
        this.conn = conn;
        this.world = world;
    }

    /**
     * @returns {DBWorld}
     */
    async init() {
        this.migrations = new DBWorldMigration(this.conn, this.world, this.getDefaultPlayerStats, this.getDefaultPlayerIndicators);
        await this.migrations.apply();
        this.mobs = new DBWorldMob(this.conn, this.world, this.getDefaultPlayerStats, this.getDefaultPlayerIndicators);
        await this.mobs.init();
        this.quests = new DBWorldQuest(this.conn, this.world);
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
    static async openDB(conn, world) {
        return await new DBWorld(conn, world).init();
    }

    /**
     * Возвращает мир по его GUID либо создает и возвращает его
     * @param {string} world_guid 
     * @returns 
     */
    async getWorld(world_guid) {
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
            }
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

    async updateAddTime(world_guid, add_time) {
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

    // getDefaultPlayerIndicators...
    getDefaultPlayerIndicators() {
        return {
            live: {
                name:  'live',
                value: 20,
            },
            food: {
                name:  'food',
                value: 20,
            },
            oxygen: {
                name:  'oxygen',
                value: 20,
            },
        };
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

    // Register new player or return existed
    async registerPlayer(world, player) {
        // Find existing user record
        const row = await this.conn.get("SELECT id, inventory, pos, pos_spawn, rotate, indicators, chunk_render_dist, game_mode, stats FROM user WHERE guid = ?", [player.session.user_guid]);
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

            const state = {
                pos:                new Vector(JSON.parse(row.pos)),
                pos_spawn:          new Vector(JSON.parse(row.pos_spawn)),
                rotate:             new Vector(JSON.parse(row.rotate)),
                indicators:         JSON.parse(row.indicators),
                chunk_render_dist:  row.chunk_render_dist,
                game_mode:          row.game_mode || world.info.game_mode,
                stats:              JSON.parse(row.stats)
            };
            return {
                state: state,
                inventory: inventory,
                status: state.indicators.live.value ? PLAYER_STATUS_ALIVE : PLAYER_STATUS_DEAD
            };
        }
        const default_pos_spawn = world.info.pos_spawn;
        // Insert to DB
        await this.conn.run('INSERT INTO user(id, guid, username, dt, pos, pos_spawn, rotate, inventory, indicators, is_admin, stats) VALUES(:id, :guid, :username, :dt, :pos, :pos_spawn, :rotate, :inventory, :indicators, :is_admin, :stats)', {
            ':id':          player.session.user_id,
            ':dt':          unixTime(),
            ':guid':        player.session.user_guid,
            ':username':    player.session.username,
            ':pos':         JSON.stringify(default_pos_spawn),
            ':pos_spawn':   JSON.stringify(default_pos_spawn),
            ':rotate':      JSON.stringify(new Vector(0, 0, Math.PI)),
            ':inventory':   JSON.stringify(this.getDefaultInventory()),
            ':indicators':  JSON.stringify(this.getDefaultPlayerIndicators()),
            ':is_admin':    (world.info.user_id == player.session.user_id) ? 1 : 0,
            ':stats':       JSON.stringify(this.getDefaultPlayerStats())
        });
        player = await this.registerPlayer(world, player);
        player.status = PLAYER_STATUS_WAITING_DATA;
        return player;
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

    async bulkUpdateInventory(rows) {
        return rows.length
            ? run(this.conn, this.BULK_UPDATE_INVENTORY, [JSON.stringify(rows)])
            : null;
    };
    BULK_UPDATE_INVENTORY = preprocessSQL(`
        UPDATE user
        SET inventory = %1
        FROM json_each(?)
        WHERE user.id = %0
    `);

    static toPlayerUpdateRow(player) {
        const state = player.state;
        return [
            player.session.user_id,
            JSON.stringify(state.pos),
            JSON.stringify(state.rotate),
            JSON.stringify(state.indicators),
            JSON.stringify(state.stats)
        ];
    }

    async bulkUpdatePlayerState(rows, dt) {
        return rows.length ? run(this.conn, this.BULK_UPDATE_PLAYER_STATE, {
            ':jsonRows': JSON.stringify(rows),
            ':dt':  dt
        }) : null;
    };
    BULK_UPDATE_PLAYER_STATE = preprocessSQL(`
        UPDATE user
        SET pos = %1, rotate = %2, indicators = %3, stats = %4, dt_moved = :dt
        FROM json_each(:jsonRows)
        WHERE user.id = %0
    `);

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
    async findPlayer(world_id, username) {
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

    async bulkInsertDropItems(rows, dt) {
        return rows.length ? run(this.conn, this.BULK_INSERT_DROP_ITEMS, {
            ':jsonRows': JSON.stringify(rows),
            ':dt': dt
        }) : null;
    };
    BULK_INSERT_DROP_ITEMS = preprocessSQL(`
        INSERT INTO drop_item (entity_id, dt, items, x, y, z)
        SELECT %0, %1, %2, %3, %4, %5
        FROM json_each(:jsonRows)
    `);

    async bulkUpdateDropItems(rows) {
        return rows.length ? run(this.conn, this.BULK_UPDATE_DROP_ITEMS, {
            ':jsonRows': JSON.stringify(rows)
        }) : null;
    };
    BULK_UPDATE_DROP_ITEMS = preprocessSQL(`
        UPDATE drop_item
        SET dt = %1, items = %2, x = %3, y = %4, z = %5
        FROM json_each(:jsonRows)
        WHERE entity_id = %0
    `);

    async bulkDeleteDropItems(entityIds) {
        return entityIds.length ? run(this.conn, 
            'DELETE FROM drop_item WHERE entity_id IN (SELECT value FROM json_each(?))',
            [JSON.stringify(entityIds)]
        ) : null;
    };

    // Delete all old drop items
    async removeDeadDrops() {
        await this.conn.run('DELETE FROM drop_item WHERE dt < :dt', {
            ':dt': ~~(unixTime() - DROP_LIFE_TIME_SECONDS)
        });
    }

    /**
     * Loads drop items in a given volume.
     * @param {Vector} coord the lower corner
     * @param {Vector} size
     * @returns {Map} items by entity_id
     */
    async loadDropItems(coord, size) {
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
            }, false);
            resp.set(item.entity_id, item);
        }
        return resp;
    }

    // Change player game mode
    async changeGameMode(player, game_mode) {
        return await this.conn.run('UPDATE user SET game_mode = :game_mode WHERE id = :id', {
            ':id':              player.session.user_id,
            ':game_mode':       game_mode
        });
    }

    /**
     * TO DO EN список точек для телепортации
     * @param {number} id id игрока
     * @return {Object} список доступных точек для телепортации
     */
    async getListTeleportPoints(id) {
        const rows = await this.conn.all("SELECT title, x, y, z FROM teleport_points WHERE user_id = :id ", {
            ":id" : parseInt(id)
        });
        if(!rows) {
            return null;
        }
        return rows;
    }

    /**
     * TO DO EN получает коодинаты точки игрока с именем title
     * @param {number} id id тгрока
     * @param {string} title имя точки
     */
    async getTeleportPoint(id, title) {
        const clear_title = title.replace(/[^a-z0-9\s]/gi, '').substr(0, 50);
        const row = await this.conn.get("SELECT x, y, z FROM teleport_points WHERE user_id = :id AND title=:title ", {
            ":id" : parseInt(id),
            ":title": clear_title
        });
        if(!row) {
            return null;
        }
        return row;
    }

    /**
     * TO DO EN добавляет положение игрока в список с именем title
     * @param {number} user_id id игрока
     * @param {string} title имя точки
     * @param {number} x x точки
     * @param {number} y y точки
     * @param {number} z z точки
     */
    async addTeleportPoint(user_id, title, x, y, z) {
        const clear_title = title.replace(/[^a-z0-9\s]/gi, '').substr(0, 50);
        await this.conn.run("INSERT INTO teleport_points(user_id, title, x, y, z) VALUES (:user_id, :title, :x, :y, :z)", {
            ":user_id": parseInt(user_id),
            ":title":   clear_title,
            ":x":       x,
            ":y":       y + 0.5,
            ":z":       z
        });
    }

    //
    async saveGameRules(world_guid, rules) {
        await this.conn.run('UPDATE world SET rules = :rules WHERE guid = :world_guid', {
            ':world_guid':  world_guid,
            ':rules':    JSON.stringify(rules)
        });
    }

    //
    async setWorldSpawn(world_guid, pos_spawn) {
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

    async setTitle(title)  {
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