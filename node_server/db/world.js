import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../../www/js/chunk_const.js";
import { getChunkAddr, Vector, unixTime } from "../../www/js/helpers.js";
import { ServerClient } from "../../www/js/server_client.js";
import { BLOCK} from "../../www/js/blocks.js";
import { DropItem } from '../drop_item.js';
import { INVENTORY_SLOT_COUNT, WORLD_TYPE_BUILDING_SCHEMAS, WORLD_TYPE_NORMAL, PLAYER_STATUS_ALIVE, PLAYER_STATUS_DEAD, PLAYER_STATUS_WAITING_DATA } from '../../www/js/constant.js';

// Database packages
import { DBWorldMob } from './world/mob.js';
import { DBWorldMigration } from './world/migration.js';
import { DBWorldQuest } from './world/quest.js';
import { DROP_LIFE_TIME_SECONDS } from "../../www/js/constant.js";
import { DBWorldPortal } from "./world/portal.js";
import { DBWorldFluid } from "./world/fluid.js";
import { compressWorldModifyChunk, decompressWorldModifyChunk } from "../../www/js/compress/world_modify_chunk.js";
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
        await this.compressModifiers();
        this.mobs = new DBWorldMob(this.conn, this.world, this.getDefaultPlayerStats, this.getDefaultPlayerIndicators);
        this.quests = new DBWorldQuest(this.conn, this.world);
        this.portal = new DBWorldPortal(this.conn, this.world);
        this.fluid = new DBWorldFluid(this.conn, this.world);
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

    //
    async compressModifiers() {
        let p_start = performance.now();
        let chunks_count = 0;
        const rows = await this.conn.all('SELECT _rowid_ AS rowid, data FROM world_modify_chunks WHERE has_data_blob = 0', {});
        for(let row of rows) {
            chunks_count++;
            let p = performance.now();
            const compressed = compressWorldModifyChunk(JSON.parse(row.data), true);
            let p1 = Math.round((performance.now() - p) * 1000) / 1000;
            p = performance.now();
            // save compressed
            await this.conn.run('UPDATE world_modify_chunks SET data_blob = :data_blob, private_data_blob = :private_data_blob, has_data_blob = 1 WHERE _rowid_ = :_rowid_', {
                ':data_blob':  compressed.public,
                ':private_data_blob':  compressed.private,
                ':_rowid_':    row.rowid
            });
            let p2 = Math.round((performance.now() - p) * 1000) / 1000;
            console.log(`compressModifiers: upd times: ${p1}, ${p2} ms`);
        }
        console.log(`compressModifiers: chunks: ${chunks_count}, elapsed: ${Math.round((performance.now() - p_start) * 1000) / 1000} ms`);
        return true;
    }

    //
    async saveCompressedWorldModifyChunk(addr, compressed, private_compressed) {
        const row = await this.conn.get('SELECT _rowid_ AS rowid FROM world_modify_chunks WHERE x = ? AND y = ? AND z = ?', [addr.x, addr.y, addr.z]);
        if (row) {
            await this.conn.run(`UPDATE world_modify_chunks SET data_blob = :data_blob,
              private_data_blob = :private_data_blob, has_data_blob = 1 WHERE _rowid_ = :rowid`, {
                ':data_blob':           compressed,
                ':private_data_blob':   private_compressed,
                ':rowid':               row.rowid
            });
            return;
        }
        await this.conn.run(`INSERT OR REPLACE INTO world_modify_chunks (x, y, z, data, data_blob, private_data_blob, has_data_blob)
          VALUES (:x, :y, :z, COALESCE((SELECT data FROM world_modify_chunks WHERE x = :x AND y = :y AND z = :z), NULL), :data_blob, :private_data_blob, 1)`, {
            ':data_blob':   compressed,
            ':private_data_blob': private_compressed,
            ':x':           addr.x,
            ':y':           addr.y,
            ':z':           addr.z
        });
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
                    if(mat) {
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

    // savePlayerInventory...
    async savePlayerInventory(player, params) {
        await this.conn.run('UPDATE user SET inventory = :inventory WHERE id = :id', {
            ':id':              player.session.user_id,
            ':inventory':       JSON.stringify(params)
        });
    }

    // savePlayerState...
    async savePlayerState(player) {
        player.position_changed = false;
        await this.conn.run('UPDATE user SET pos = :pos, rotate = :rotate, dt_moved = :dt_moved, indicators = :indicators, stats = :stats WHERE id = :id', {
            ':id':              player.session.user_id,
            ':pos':             JSON.stringify(player.state.pos),
            ':rotate':          JSON.stringify(player.state.rotate),
            ':indicators':      JSON.stringify(player.state.indicators),
            ':dt_moved':        unixTime(),
            ':stats':           JSON.stringify(player.state.stats),
        });
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

    // saveChestSlots...
    async saveChestSlots(chest) {
        const rows = await this.conn.all('SELECT _rowid_ AS rowid, extra_data FROM world_modify WHERE x = :x AND y = :y AND z = :z ORDER BY id DESC LIMIT 1', {
            ':x': chest.pos.x,
            ':y': chest.pos.y,
            ':z': chest.pos.z
        });
        for(let row of rows) {
            const extra_data = row.extra_data ? JSON.parse(row.extra_data) : {};
            extra_data.slots = chest.slots;
            // save slots
            await this.conn.run('UPDATE world_modify SET extra_data = :extra_data WHERE id = :id', {
                ':extra_data':  JSON.stringify(extra_data),
                ':id':          row.rowid
            });
            // update chunk
            this.updateChunks([getChunkAddr(chest.pos)]);
            return true;
        }
        return false;
    }

    // Chunk became modified
    async chunkBecameModified() {
        const resp = new Set();
        const rows = await this.conn.all(`SELECT DISTINCT x chunk_x, y chunk_y, z chunk_z FROM world_modify_chunks`);
        for(let row of rows) {
            let addr = new Vector(row.chunk_x, row.chunk_y, row.chunk_z);
            resp.add(addr);
        }
        return resp
    }

    // Create drop item
    async createDropItem(params) {
        const entity_id = randomUUID();
        let dt = unixTime();
        await this.conn.run('INSERT INTO drop_item(dt, entity_id, items, x, y, z) VALUES(:dt, :entity_id, :items, :x, :y, :z)', {
            ':dt':              dt,
            ':entity_id':       entity_id,
            ':items':           JSON.stringify(params.items),
            ':x':               params.pos.x,
            ':y':               params.pos.y,
            ':z':               params.pos.z
        });
        return {
            entity_id,
            dt
        };
    }

    async updateDropItem(params) {
        await this.conn.run('UPDATE drop_item SET items = :items, x = :x, y = :y, z = :z WHERE entity_id = :entity_id', {
            ':items':           JSON.stringify(params.items),            
            ':x':               params.pos.x,
            ':y':               params.pos.y,
            ':z':               params.pos.z,
            ':entity_id':       params.entity_id
        });
    }

    // Delete drop item
    async removeDeadDrops() {
        await this.conn.run('DELETE FROM drop_item WHERE dt < :dt', {
            ':dt': ~~(unixTime() - DROP_LIFE_TIME_SECONDS)
        });
    }

    // Delete drop item
    async deleteDropItem(entity_id) {
        await this.conn.run('DELETE FROM drop_item WHERE entity_id = :entity_id', {
            ':entity_id': entity_id
        });
    }

    // Load drop items
    async loadDropItems(addr, size) {
        const rows = await this.conn.all('SELECT * FROM drop_item WHERE x >= :x_min AND x < :x_max AND y >= :y_min AND y < :y_max AND z >= :z_min AND z < :z_max AND dt >= :death_date', {
            ':death_date' : ~~(Date.now() / 1000 - DROP_LIFE_TIME_SECONDS),
            ':x_min': addr.x * size.x,
            ':x_max': addr.x * size.x + size.x,
            ':y_min': addr.y * size.y,
            ':y_max': addr.y * size.y + size.y,
            ':z_min': addr.z * size.z,
            ':z_max': addr.z * size.z + size.z
        });
        const resp = new Map();
        for(let row of rows) {
            const item = new DropItem(this.world, {
                dt:         row.dt,
                id:         row.id,
                pos:        new Vector(row.x, row.y, row.z),
                entity_id:  row.entity_id,
                items:      JSON.parse(row.items)
            });
            resp.set(item.entity_id, item);
        }
        return resp;
    }

    // Load chunk modify list
    async loadChunkModifiers(addr) {
        const resp = {obj: null, compressed: null, private_compressed: null};
        await this.conn.each(`
                SELECT CASE WHEN data_blob IS NULL THEN data ELSE data_blob END data,
                    private_data_blob, has_data_blob
                FROM world_modify_chunks
                WHERE x = :x AND y = :y AND z = :z`, {
            ':x': addr.x,
            ':y': addr.y,
            ':z': addr.z
        }, function(err, row) {
            if(err) {
                console.error(err);
            } else {
                if(row.has_data_blob) {
                    resp.compressed = row.data;
                    resp.private_compressed = row.private_data_blob;
                } else {
                    resp.obj = JSON.parse(row.data);
                }
            }
        });
        if(resp.compressed) {
            resp.obj = decompressWorldModifyChunk(resp.compressed);
            if (resp.private_compressed) {
                const private_obj = decompressWorldModifyChunk(resp.private_compressed);
                Object.assign(resp.obj, private_obj);
            }
        }
        return resp;
    }

    async saveChunkDelayedCalls(chunk) {
        const addr = chunk.addrHash;
        const delayed_calls = chunk.delayedCalls.serialize();
        const result = this.conn.run('INSERT OR IGNORE INTO chunk (dt, addr, delayed_calls) VALUES (:dt, :addr, :delayed_calls)', {
            ':dt': unixTime(),
            ':addr': addr,
            ':delayed_calls': delayed_calls
        });
        // It works both in single- and multi- player. In single, it always runs the update.
        if (!result.changes) {
            this.conn.run('UPDATE chunk SET delayed_calls = :delayed_calls WHERE addr = :addr', {
                ':addr': addr,
                ':delayed_calls': delayed_calls
            });
        }
    }

    async loadAndDeleteChunkDelayedCalls(chunk) {
        const row = await this.conn.get('SELECT delayed_calls FROM chunk WHERE addr = ?', [chunk.addrHash]);
        const delayed_calls = row?.delayed_calls;
        if (!delayed_calls) {
            return null;
        }
        await this.conn.run('UPDATE chunk SET delayed_calls = NULL WHERE addr = ?', [chunk.addrHash]);
        return delayed_calls;
    }

    // Block set
    async blockSet(world, player, params) {
        let item = params.item;
        const is_modify = params.action_id == ServerClient.BLOCK_ACTION_MODIFY;
        if(item.id == 0) {
            item = null;
        } else {
            let material = BLOCK.fromId(item.id);
            if(!material) {
                throw 'error_block_not_found';
            }
            if(!material?.can_rotate && 'rotate' in item) {
                delete(item.rotate);
            }
            if('entity_id' in item && !item.entity_id) {
                delete(item.entity_id);
            }
            if('extra_data' in item && !item.extra_data) {
                delete(item.extra_data);
            }
            if('power' in item && item.power === 0) {
                delete(item.power);
            }
        }
        let need_insert = true;
        if(is_modify) {
            let rows = await this.conn.all('SELECT _rowid_ AS rowid FROM world_modify WHERE x = :x AND y = :y AND z = :z ORDER BY id DESC LIMIT 1', {
                ':x': params.pos.x,
                ':y': params.pos.y,
                ':z': params.pos.z
            });
            for(let row of rows) {
                need_insert = false;
                await this.conn.run('UPDATE world_modify SET params = :params, entity_id = :entity_id, extra_data = :extra_data, block_id = :block_id WHERE _rowid_ = :_rowid_', {
                    ':_rowid_':     row.rowid,
                    ':params':      item ? JSON.stringify(item) : null,
                    ':entity_id':   item?.entity_id ? item.entity_id : null,
                    ':extra_data':  item?.extra_data ? JSON.stringify(item.extra_data) : null,
                    ':block_id':    item?.id,
                    //':rotate':      item?.rotate ? JSON.stringify(item.rotate) : null
                });
            }
        }
        if(need_insert) {
            const run_data = {
                ':user_id':     player?.session.user_id || null,
                ':dt':          unixTime(),
                ':world_id':    world.info.id,
                ':x':           params.pos.x,
                ':y':           params.pos.y,
                ':z':           params.pos.z,
                ':chunk_x':     Math.floor(params.pos.x / CHUNK_SIZE_X),
                ':chunk_y':     Math.floor(params.pos.y / CHUNK_SIZE_Y),
                ':chunk_z':     Math.floor(params.pos.z / CHUNK_SIZE_Z),
                ':params':      item ? JSON.stringify(item) : null,
                ':entity_id':   item?.entity_id ? item.entity_id : null,
                ':extra_data':  item?.extra_data ? JSON.stringify(item.extra_data) : null,
                ':block_id':    item?.id || null,
                ':index':       params.pos.getFlatIndexInChunk()
                //':rotate':      item?.rotate ? JSON.stringify(item.rotate) : null
            };
            await this.conn.run('INSERT INTO world_modify(user_id, dt, world_id, params, x, y, z, entity_id, extra_data, block_id, chunk_x, chunk_y, chunk_z, "index") VALUES (:user_id, :dt, :world_id, :params, :x, :y, :z, :entity_id, :extra_data, :block_id, :chunk_x, :chunk_y, :chunk_z, :index)', run_data);
        }
        if (item && 'extra_data' in item) {
            // @todo Update extra data
        }
    }

    // Bulk block set
    async blockSetBulk(world, player, data) {
        const user_id = player?.session.user_id || null;
        const dt =  unixTime();
        const world_id = world.info.id;
        for (var i = 0; i < data.length; i++) {
            const params = data[i];
            const item = params.item;
            data[i] = [
                user_id,
                dt,
                world_id,
                // params
                JSON.stringify(item),
                params.pos.x,
                params.pos.y,
                params.pos.z,
                // chunk xyz
                Math.floor(params.pos.x / CHUNK_SIZE_X),
                Math.floor(params.pos.y / CHUNK_SIZE_Y),
                Math.floor(params.pos.z / CHUNK_SIZE_Z),
                item.entity_id ? item.entity_id : null,
                item.extra_data ? JSON.stringify(item.extra_data) : null,
                // block_id
                item.id,
                // index
                params.pos.getFlatIndexInChunk()
            ];
        }
        //
        await this.conn.run(`INSERT INTO world_modify(
                user_id, dt, world_id, params, x, y, z, chunk_x, chunk_y, chunk_z,
                entity_id, extra_data, block_id, "index"
            )
            SELECT
                json_extract(value, '$[0]'),
                json_extract(value, '$[1]'),
                json_extract(value, '$[2]'),
                json_extract(value, '$[3]'),
                json_extract(value, '$[4]'),
                json_extract(value, '$[5]'),
                json_extract(value, '$[6]'),
                json_extract(value, '$[7]'),
                json_extract(value, '$[8]'),
                json_extract(value, '$[9]'),
                json_extract(value, '$[10]'),
                json_extract(value, '$[11]'),
                json_extract(value, '$[12]'),
                json_extract(value, '$[13]')
            FROM json_each(:data)`, {
                ':data': JSON.stringify(data)
            });
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
    async updateChunks(address_list) {
        await this.conn.run(`INSERT INTO world_modify_chunks(x, y, z, data, data_blob, private_data_blob, has_data_blob)
        SELECT
            json_extract(value, '$.x') x,
            json_extract(value, '$.y') y,
            json_extract(value, '$.z') z,
            (SELECT
                json_group_object(cast(m."index" as TEXT),
                json_patch(
                    'null',
                    json_object(
                        'id',           COALESCE(m.block_id, 0),
                        'extra_data',   json(m.extra_data),
                        'entity_id',    m.entity_id,
                        'ticks',        m.ticks,
                        'rotate',       json_extract(m.params, '$.rotate')
                    )
                ))
                FROM world_modify m
                WHERE m.chunk_x = json_extract(value, '$.x') AND
                    m.chunk_y = json_extract(value, '$.y') AND
                    m.chunk_z = json_extract(value, '$.z')
                ORDER BY m.id ASC
            ),
            NULL,
            NULL,
            0
        FROM json_each(:address_list) addrs`, {
            ':address_list': JSON.stringify(address_list)
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
        await this.conn.run('UPDATE user SET ender_chest = :ender_chest WHERE id = :id', {
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

}