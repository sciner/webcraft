import { v4 as uuid } from 'uuid';
import path from 'path'
import sqlite3 from 'sqlite3'
import {open} from 'sqlite'
import { copyFile } from 'fs/promises';

import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../www/js/chunk_const.js";
import {Vector} from "../www/js/helpers.js";
import {ServerClient} from "../www/js/server_client.js";
import {BLOCK} from "../www/js/blocks.js";
import { DropItem } from './drop_item.js';
import { INVENTORY_SLOT_COUNT } from '../www/js/constant.js';

//
import { DBWorldMob } from './world/db/db_mob.js';
import { DBWorldMigration } from './world/db/db_migration.js';
import { DBWorldQuest } from './world/db/db_world_quest.js';

export class DBWorld {

    static TEMPLATE_DB = './world.sqlite3.template';

    constructor(db, world) {
        this.db = db;
        this.world = world;
    }

    async init() {
        this.migrations = new DBWorldMigration(this.db, this.world, this.getDefaultPlayerStats, this.getDefaultPlayerIndicators);
        await this.migrations.apply();
        this.mobs = new DBWorldMob(this.db, this.world, this.getDefaultPlayerStats, this.getDefaultPlayerIndicators);
        this.quests = new DBWorldQuest(this.db, this.world);
    }

    // Open database and return provider
    static async openDB(dir, world) {
        let filename = dir + '/world.sqlite';
        filename = path.resolve(filename);
        // Check directory exists
        if (!fs.existsSync(dir)) {
            await fs.mkdirSync(dir, {recursive: true});
        }
        // Recheck directory exists
        if (!fs.existsSync(dir)) {
            throw 'World directory not found: ' + dir;
        }
        // If DB file not exists, then create it from template
        if (!fs.existsSync(filename)) {
            // create db from template
            let template_db_filename = path.resolve(DBWorld.TEMPLATE_DB);
            await copyFile(template_db_filename, filename);
        }
        // Open SQLIte3 fdatabase file
        const dbc = await open({
            filename: filename,
            driver: sqlite3.Database
        }).then(async (conn) => {
            return new DBWorld(conn, world);
        });
        // Init DB
        await dbc.init();
        return dbc;
    }

    // Возвращает мир по его GUID либо создает и возвращает его
    async getWorld(world_guid) {
        let row = await this.db.get("SELECT * FROM world WHERE guid = ?", [world_guid]);
        if(row) {
            return {
                id:         row.id,
                user_id:    row.user_id,
                dt:         row.dt,
                guid:       row.guid,
                title:      row.title,
                seed:       row.seed,
                game_mode:  row.game_mode,
                generator:  JSON.parse(row.generator),
                pos_spawn:  JSON.parse(row.pos_spawn),
                state:      null,
                add_time:   row.add_time
            }
        }
        // Insert new world to Db
        let world = await Game.db.getWorld(world_guid);
        await this.db.run('INSERT INTO world(dt, guid, user_id, title, seed, generator, pos_spawn) VALUES (:dt, :guid, :user_id, :title, :seed, :generator, :pos_spawn)', {
            ':dt':          ~~(Date.now() / 1000),
            ':guid':        world.guid,
            ':user_id':     world.user_id,
            ':title':       world.title,
            ':seed':        world.seed,
            ':generator':   JSON.stringify(world.generator),
            ':pos_spawn':   JSON.stringify(world.pos_spawn)
        });
        // let world_id = result.lastID;
        return this.getWorld(world_guid);
    }

    async updateAddTime(world_guid, add_time) {
        await this.db.run('UPDATE world SET add_time = :add_time WHERE guid = :world_guid', {
            ':world_guid':  world_guid,
            ':add_time':    add_time
        });
    }

    async TransactionBegin() {
        await this.db.get('begin transaction');
    }

    async TransactionCommit() {
        await this.db.get('commit');
    }

    async TransactionRollback() {
        await this.db.get('rollback');
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
                value: 10,
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
        const row = await this.db.get("SELECT id, inventory, pos, pos_spawn, rotate, indicators, chunk_render_dist, game_mode, stats FROM user WHERE guid = ?", [player.session.user_guid]);
        if(row) {
            const inventory = JSON.parse(row.inventory);
            if(inventory.items.length < INVENTORY_SLOT_COUNT) {
                inventory.items.push(...new Array(INVENTORY_SLOT_COUNT - inventory.items.length).fill(null));
            }
            // Added new property
            if(inventory.current.index2 === undefined) {
                inventory.current.index2 = -1;
            }
            return {
                state: {
                    pos:                new Vector(JSON.parse(row.pos)),
                    pos_spawn:          new Vector(JSON.parse(row.pos_spawn)),
                    rotate:             new Vector(JSON.parse(row.rotate)),
                    indicators:         JSON.parse(row.indicators),
                    chunk_render_dist:  row.chunk_render_dist,
                    game_mode:          row.game_mode || world.info.game_mode,
                    stats:              JSON.parse(row.stats)
                },
                inventory: inventory
            };
        }
        const default_pos_spawn = world.info.pos_spawn;
        // Insert to DB
        const result = await this.db.run('INSERT INTO user(id, guid, username, dt, pos, pos_spawn, rotate, inventory, indicators, is_admin, stats) VALUES(:id, :guid, :username, :dt, :pos, :pos_spawn, :rotate, :inventory, :indicators, :is_admin, :stats)', {
            ':id':          player.session.user_id,
            ':dt':          ~~(Date.now() / 1000),
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
        return await this.registerPlayer(world, player);
    }

    // Добавление сообщения в чат
    async insertChatMessage(player, params) {
        const result = await this.db.run('INSERT INTO chat_message(user_id, dt, text, world_id, user_session_id) VALUES (:user_id, :dt, :text, :world_id, :user_session_id)', {
            ':user_id':         player.session.user_id,
            ':dt':              ~~(Date.now() / 1000),
            ':text':            params.text,
            ':world_id':        this.world.info.id,
            ':user_session_id': 0
        });
        let chat_message_id = result.lastID;
        return chat_message_id;
    }

    // savePlayerInventory...
    async savePlayerInventory(player, params) {
        const result = await this.db.run('UPDATE user SET inventory = :inventory WHERE id = :id', {
            ':id':              player.session.user_id,
            ':inventory':       JSON.stringify(params)
        });
    }

    // savePlayerState...
    async savePlayerState(player) {
        player.position_changed = false;
        const result = await this.db.run('UPDATE user SET pos = :pos, rotate = :rotate, dt_moved = :dt_moved, indicators = :indicators, stats = :stats WHERE id = :id', {
            ':id':              player.session.user_id,
            ':pos':             JSON.stringify(player.state.pos),
            ':rotate':          JSON.stringify(player.state.rotate),
            ':indicators':      JSON.stringify(player.state.indicators),
            ':dt_moved':        ~~(Date.now() / 1000),
            ':stats':           JSON.stringify(player.state.stats),
        });
    }

    // changePosSpawn...
    async changePosSpawn(player, params) {
        await this.db.run('UPDATE user SET pos_spawn = :pos_spawn WHERE id = :id', {
            ':id':             player.session.user_id,
            ':pos_spawn':      JSON.stringify(params.pos)
        });
    }

    // changeRenderDist...
    async changeRenderDist(player, value) {
        await this.db.run('UPDATE user SET chunk_render_dist = :chunk_render_dist WHERE id = :id', {
            ':id':                  player.session.user_id,
            ':chunk_render_dist':   value
        });
    }

    // Вычитка списка администраторов
    async loadAdminList(world_id)  {
        let resp = [];
        let rows = await this.db.all('SELECT username FROM user WHERE is_admin = ?', [world_id]);
        for(let row of rows) {
            resp.push(row.username);
        }
        return resp;
    }

    // findPlayer...
    async findPlayer(world_id, username) {
        let row = await this.db.get("SELECT id, username FROM user WHERE lower(username) = LOWER(?)", [username]);
        if(!row) {
            return null;
        }
        return row;
    }

    // setAdmin...
    async setAdmin(world_id, user_id, is_admin) {
        let result = await this.db.get("UPDATE user SET is_admin = ? WHERE id = ?", [is_admin, user_id]);
    }

    // saveChestSlots...
    async saveChestSlots(chest) {
        let rows = await this.db.all('SELECT id, extra_data FROM world_modify WHERE x = :x AND y = :y AND z = :z ORDER BY id DESC LIMIT 1', {
            ':x': chest.pos.x,
            ':y': chest.pos.y,
            ':z': chest.pos.z
        });
        for(let row of rows) {
            let extra_data = row.extra_data ? JSON.parse(row.extra_data) : {};
            extra_data.slots = chest.slots;
            extra_data.can_destroy = !chest.slots || Object.entries(chest.slots).length == 0;
            await this.db.run('UPDATE world_modify SET extra_data = :extra_data WHERE id = :id', {
                ':extra_data':  JSON.stringify(extra_data),
                ':id':          row.id
            });
            return true;
        }
        return false;
    }

    // Chunk became modified
    async chunkBecameModified() {
        let resp = new Set();
        let rows = await this.db.all(`SELECT DISTINCT
            cast(x / ${CHUNK_SIZE_X} as int) - (x / ${CHUNK_SIZE_X} < cast(x / ${CHUNK_SIZE_X} as int)) AS x,
            cast(y / ${CHUNK_SIZE_Y} as int) - (y / ${CHUNK_SIZE_Y} < cast(y / ${CHUNK_SIZE_Y} as int)) AS y,
            cast(z / ${CHUNK_SIZE_Z} as int) - (z / ${CHUNK_SIZE_Z} < cast(z / ${CHUNK_SIZE_Z} as int)) AS z
        FROM world_modify`);
        for(let row of rows) {
            let addr = new Vector(row.x, row.y, row.z);
            resp.add(addr);
        }
        return resp
    }

    // Create drop item
    async createDropItem(params) {
        const entity_id = uuid();
        const result = await this.db.run('INSERT INTO drop_item(dt, entity_id, items, x, y, z) VALUES(:dt, :entity_id, :items, :x, :y, :z)', {
            ':dt':              ~~(Date.now() / 1000),
            ':entity_id':       entity_id,
            ':items':           JSON.stringify(params.items),
            ':x':               params.pos.x,
            ':y':               params.pos.y,
            ':z':               params.pos.z
        });
        return {
            entity_id: entity_id
        };
    }

    // Delete drop item
    async deleteDropItem(entity_id) {
        const result = await this.db.run('UPDATE drop_item SET is_deleted = :is_deleted WHERE entity_id = :entity_id', {
            ':is_deleted': 1,
            ':entity_id': entity_id
        });
    }

    // Load drop items
    async loadDropItems(addr, size) {
        let rows = await this.db.all('SELECT * FROM drop_item WHERE is_deleted = 0 AND x >= :x_min AND x < :x_max AND y >= :y_min AND y < :y_max AND z >= :z_min AND z < :z_max', {
            ':x_min': addr.x * size.x,
            ':x_max': addr.x * size.x + size.x,
            ':y_min': addr.y * size.y,
            ':y_max': addr.y * size.y + size.y,
            ':z_min': addr.z * size.z,
            ':z_max': addr.z * size.z + size.z
        });
        let resp = new Map();
        for(let row of rows) {
            let item = new DropItem(this.world, {
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
    async loadChunkModifiers(addr, size) {
        const mul = new Vector(10, 10, 10); // 116584
        let resp = new Map();
        let rows = await this.db.all("SELECT x, y, z, params, 1 as power, entity_id, extra_data, ticks FROM world_modify WHERE id IN (select max(id) FROM world_modify WHERE x >= :x_min AND x < :x_max AND y >= :y_min AND y < :y_max AND z >= :z_min AND z < :z_max group by x, y, z)", {
            ':x_min': addr.x * size.x,
            ':x_max': addr.x * size.x + size.x,
            ':y_min': addr.y * size.y,
            ':y_max': addr.y * size.y + size.y,
            ':z_min': addr.z * size.z,
            ':z_max': addr.z * size.z + size.z
        });
        for(let row of rows) {
            let params = row.params ? JSON.parse(row.params) : null;
            // @BlockItem
            let item = {
                id: params && ('id' in params) ? params.id : 0
            };
            if(item.id > 2) {
                if(row.ticks) {
                    item.ticks = row.ticks;
                }
                if('rotate' in params && params.rotate) {
                    if(BLOCK.fromId(item.id)?.can_rotate) {
                        item.rotate = new Vector(params.rotate).mul(mul).round().div(mul);
                    }
                }
                if('power' in params) {
                    item.power = params.power;
                }
                if('entity_id' in params && params.entity_id) {
                    item.entity_id = params.entity_id;
                }
                if(row.extra_data !== null) {
                    item.extra_data = JSON.parse(row.extra_data);
                }
            }
            //
            let pos = new Vector(row.x, row.y, row.z);
            resp.set(pos.toHash(), item);
        }
        return resp;
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
        // console.log('db.setblock:', is_modify, params.pos.x, params.pos.y, params.pos.z);
        if(is_modify) {
            let rows = await this.db.all('SELECT id, extra_data FROM world_modify WHERE x = :x AND y = :y AND z = :z ORDER BY id DESC LIMIT 1', {
                ':x': params.pos.x,
                ':y': params.pos.y,
                ':z': params.pos.z
            });
            for(let row of rows) {
                need_insert = false;
                await this.db.run('UPDATE world_modify SET params = :params, entity_id = :entity_id, extra_data = :extra_data, block_id = :block_id WHERE id = :id', {
                    ':id':          row.id,
                    ':params':      item ? JSON.stringify(item) : null,
                    ':entity_id':   item?.entity_id ? item.entity_id : null,
                    ':extra_data':  item?.extra_data ? JSON.stringify(item.extra_data) : null,
                    ':block_id':    item?.id
                });
            }
        }
        if(need_insert) {
            await this.db.run('INSERT INTO world_modify(user_id, dt, world_id, params, x, y, z, entity_id, extra_data, block_id) VALUES (:user_id, :dt, :world_id, :params, :x, :y, :z, :entity_id, :extra_data, :block_id)', {
                ':user_id':     player?.session.user_id || null,
                ':dt':          ~~(Date.now() / 1000),
                ':world_id':    world.info.id,
                ':x':           params.pos.x,
                ':y':           params.pos.y,
                ':z':           params.pos.z,
                ':params':      item ? JSON.stringify(item) : null,
                ':entity_id':   item?.entity_id ? item.entity_id : null,
                ':extra_data':  item?.extra_data ? JSON.stringify(item.extra_data) : null,
                ':block_id':    item?.id
            });
        }
        if (item && 'extra_data' in item) {
            // @todo Update extra data
        }
    }

    // Change player game mode
    async changeGameMode(player, game_mode) {
        const result = await this.db.run('UPDATE user SET game_mode = :game_mode WHERE id = :id', {
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
        let rows = await this.db.all("SELECT title, x, y, z FROM teleport_points WHERE user_id = :id ", {
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
        let clear_title = title.replace(/[^a-z0-9\s]/gi, '').substr(0, 50);
        let row = await this.db.get("SELECT x, y, z FROM teleport_points WHERE user_id = :id AND title=:title ", {
            ":id" : parseInt(id),
            ":title": clear_title
        });
        if(!row) {
            return null;
        }
        return row;
    }

    /**
     * TO DO EN добавлят положение игрока в список с именем title
     * @param {number} id id игрока
     * @param {string} title имя точки
     * @param {number} x x точки
     * @param {number} y y точки
     * @param {number} z z точки
     */
    async addTeleportPoint(id, title, x, y, z) {
        let clear_title = title.replace(/[^a-z0-9\s]/gi, '').substr(0, 50);
        await this.db.run("INSERT INTO teleport_points (user_id, title, x, y, z) VALUES (:id, :title, :x, :y, :z)", {
            ":id" : parseInt(id),
            ":title": clear_title,
            ":x": x,
            ":y": y + 0.5,
            ":z": z
        });
    }

}