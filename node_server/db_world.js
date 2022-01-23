import uuid from 'uuid';
import path from 'path'
import sqlite3 from 'sqlite3'
import {open} from 'sqlite'
import { copyFile } from 'fs/promises';

import {Chest} from "./chest.js";
import {Mob} from "./mob.js";

import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../www/js/chunk.js";
import {Vector, VectorCollector} from "../www/js/helpers.js";
import {BLOCK} from "../www/js/blocks.js";
import { DropItem } from './drop_item.js';
import { ServerWorld } from './server_world.js';

export class DBWorld {

    static TEMPLATE_DB = './world.sqlite3.template';

    constructor(db, world) {
        this.db = db;
        this.world = world;
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
        let dbc = await open({
            filename: filename,
            driver: sqlite3.Database
        }).then(async (conn) => {
            return new DBWorld(conn, world);
        });
        await dbc.applyMigrations();
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
                state:      null
            }
        }
        // Insert new world to Db
        let world = await Game.db.getWorld(world_guid);
        const result = await this.db.run('INSERT INTO world(dt, guid, user_id, title, seed, generator, pos_spawn) VALUES (:dt, :guid, :user_id, :title, :seed, :generator, :pos_spawn)', {
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

    // Migrations
    async applyMigrations() {
        let version = 0;
        try {
            // Read options
            let row = await this.db.get('SELECT version FROM options');
            version = row.version;
        } catch(e) {
            await this.db.get('begin transaction');
            await this.db.get('CREATE TABLE "options" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "version" integer NOT NULL DEFAULT 0)');
            await this.db.get('insert into options(version) values(0)');
            await this.db.get('commit');
        }
        // Version 0 -> 1
        if (version == 0) {
            await this.db.get('begin transaction');
            await this.db.get('alter table user add column indicators text');
            await this.db.run('UPDATE user SET indicators = :indicators', {
                ':indicators':  JSON.stringify(this.getDefaultPlayerIndicators()),
            });
            await this.db.get('update options set version = ' + (++version));
            await this.db.get('commit');
        }
        // Version 1 -> 2
        if (version == 1) {
            await this.db.get('begin transaction');
            await this.db.get('alter table user add column is_admin integer default 0');
            await this.db.get('update user set is_admin = 1 where id in (select user_id from world)');
            await this.db.get('update options set version = ' + (++version));
            await this.db.get('commit');
        }
        // Version 2 -> 3
        if (version == 2) {
            await this.db.get('begin transaction');
            await this.db.get(`CREATE TABLE "entity" (
                "id" INTEGER NOT NULL,
                "dt" integer,
                "entity_id" TEXT,
                "type" TEXT,
                "skin" TEXT,
                "indicators" TEXT,
                "rotate" TEXT,
                "x" real,
                "y" real,
                "z" real,
                PRIMARY KEY ("id")
              )`);
            await this.db.get('update options set version = ' + (++version));
            await this.db.get('commit');
        }
        // Version 3 -> 4
        if (version == 3) {
            await this.db.get('begin transaction');
            await this.db.get(`alter table world add column "game_mode" TEXT DEFAULT 'survival'`);
            await this.db.get(`alter table user add column "chunk_render_dist" integer DEFAULT 4`);
            await this.db.get('update options set version = ' + (++version));
            await this.db.get('commit');
        }
        // Version 4 -> 5
        if (version == 4) {
            await this.db.get('begin transaction');
            await this.db.get(`CREATE INDEX "world_modify_xyz" ON "world_modify" ("x", "y", "z")`);
            await this.db.get('update options set version = ' + (++version));
            await this.db.get('commit');
        }
        // Version 5 -> 6
        if(version == 5) {
            await this.db.get('begin transaction');
            await this.db.get(`update world_modify set params = replace(replace(replace(replace(replace(replace(replace(params,',"rotate":{"x":0,"y":0,"z":0}', ''), ',"entity_id":""', ''), ',"entity_id":null', ''), ',"extra_data":null', ''), ',"power":1', ''), '{"id":0}', ''), '{}', '') where params is not null`);
            await this.db.get(`update world_modify set params = null where params is not null and params = ''`);
            await this.db.get(`update world_modify set params = '{"id":2}' where params is not null and params like '{"id":2,%'`);
            await this.db.get('update options set version = ' + (++version));
            await this.db.get('commit');
            await this.db.get('VACUUM');
        }
        // Version 6 -> 7
        if(version == 6) {
            await this.db.get('begin transaction');
            await this.db.get(`update world_modify set params = '{"id":50,"rotate":{"x":0,"y":1,"z":0}}' where params is not null and params like '{"id":50,%'`);
            await this.db.get('update options set version = ' + (++version));
            await this.db.get('commit');
            await this.db.get('VACUUM');
        }
        // Version 7 -> 8
        if(version == 7) {
            await this.db.get('begin transaction');
            await this.db.get(`alter table entity add column "pos_spawn" TEXT NOT NULL DEFAULT ''`);
            await this.db.get(`update entity set pos_spawn = '{"x":' || x || ',"y":' || y || ',"z":' || z || '}' where pos_spawn = '';`);
            await this.db.get('update options set version = ' + (++version));
            await this.db.get('commit');
        }
        // Version 8 -> 9
        if(version == 8) {
            await this.db.get('begin transaction');
            await this.db.get(`alter table chest add column "is_deleted" integer DEFAULT 0`);
            await this.db.get('update options set version = ' + (++version));
            await this.db.get('commit');
        }
        // Version 9 -> 10
        if (version == 9) {
            await this.db.get('begin transaction');
            await this.db.get(`CREATE TABLE "drop_item" (
                "id" INTEGER NOT NULL,
                "dt" integer,
                "entity_id" TEXT,
                "items" TEXT,
                "x" real,
                "y" real,
                "z" real,
                PRIMARY KEY ("id")
              )`);
            await this.db.get('update options set version = ' + (++version));
            await this.db.get('commit');
        }
        // Version 10 -> 11
        if (version == 10) {
            await this.db.get('begin transaction');
            await this.db.get(`DROP INDEX "main"."world_modify_xyz";`);
            await this.db.get(`ALTER TABLE "main"."world_modify" RENAME TO "_world_modify_old_20211227";`);
            await this.db.get(`CREATE TABLE "main"."world_modify" (
                "id" INTEGER,
                "world_id" INTEGER NOT NULL,
                "dt" integer,
                "user_id" INTEGER,
                "params" TEXT,
                "user_session_id" INTEGER,
                "x" real NOT NULL,
                "y" real NOT NULL,
                "z" real NOT NULL,
                "entity_id" text,
                "extra_data" text,
                PRIMARY KEY ("id"),
                UNIQUE ("entity_id" ASC) ON CONFLICT ABORT
              );`);
            await this.db.get(`INSERT INTO "main"."world_modify" ("id", "world_id", "dt", "user_id", "params", "user_session_id", "x", "y", "z", "entity_id", "extra_data") SELECT "id", "world_id", "dt", "user_id", "params", "user_session_id", "x", "y", "z", "entity_id", "extra_data" FROM "main"."_world_modify_old_20211227";`);
            await this.db.get(`CREATE INDEX "main"."world_modify_xyz"
            ON "world_modify" (
              "x" ASC,
              "y" ASC,
              "z" ASC
            );`);
            await this.db.get(`DROP TABLE "_world_modify_old_20211227"`);
            await this.db.get('update options set version = ' + (++version));
            await this.db.get('commit');
        }

        const migrations = [];
        migrations.push({version: 12, queries: [`alter table drop_item add column "is_deleted" integer DEFAULT 0`]});
        migrations.push({version: 13, queries: [`alter table user add column "game_mode" TEXT DEFAULT NULL`]});
        migrations.push({version: 14, queries: [`UPDATE user SET inventory = replace(inventory, '"index2":0', '"index2":-1')`]});
        migrations.push({version: 15, queries: [`UPDATE entity SET x = json_extract(pos_spawn, '$.x'), y = json_extract(pos_spawn, '$.y'), z = json_extract(pos_spawn, '$.z')`]});
        migrations.push({version: 16, queries: [`CREATE TABLE "painting" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "user_id" integer NOT NULL,
            "dt" integer NOT NULL,
            "params" TEXT,
            "x" integer NOT NULL,
            "y" integer NOT NULL,
            "z" integer NOT NULL,
            "image_name" TEXT,
            "entity_id" TEXT,
            "world_id" INTEGER
        );`]});

        for(let m of migrations) {
            if(m.version > version) {
                await this.db.get('begin transaction');
                for(let query of m.queries) {
                    await this.db.get(query);
                }
                await this.db.get('update options set version = ' + (++version));
                await this.db.get('commit');
                version = m.version;
                console.info('Migration applied : ' + version);
            }
        }

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
        const MAX_COUNT = 36;
        const resp = {
            items: [],
            current: {
                index: 0, // right hand
                index2: -1 // left hand
            }
        };
        for(let i = 0; i < MAX_COUNT; i++) {
            resp.items.push(null);
        }
        return resp;
    }

    // Register new user or return existed
    async registerUser(world, player) {
        // Find existing user record
        let row = await this.db.get("SELECT id, inventory, pos, pos_spawn, rotate, indicators, chunk_render_dist, game_mode FROM user WHERE guid = ?", [player.session.user_guid]);
        if(row) {
            let inventory = JSON.parse(row.inventory);
            // Added new property
            if(inventory.current.index2 === undefined) {
                inventory.current.index2 = -1;
            }
            return {
                state: {
                    pos:                JSON.parse(row.pos),
                    pos_spawn:          JSON.parse(row.pos_spawn),
                    rotate:             JSON.parse(row.rotate),
                    indicators:         JSON.parse(row.indicators),
                    chunk_render_dist:  row.chunk_render_dist,
                    game_mode:          row.game_mode || world.info.game_mode
                },
                inventory: inventory
            };
        }
        let default_pos_spawn = world.info.pos_spawn;
        // Insert to DB
        const result = await this.db.run('INSERT INTO user(id, guid, username, dt, pos, pos_spawn, rotate, inventory, indicators, is_admin) VALUES(:id, :guid, :username, :dt, :pos, :pos_spawn, :rotate, :inventory, :indicators, :is_admin)', {
            ':id':          player.session.user_id,
            ':dt':          ~~(Date.now() / 1000),
            ':guid':        player.session.user_guid,
            ':username':    player.session.username,
            ':pos':         JSON.stringify(default_pos_spawn),
            ':pos_spawn':   JSON.stringify(default_pos_spawn),
            ':rotate':      JSON.stringify(new Vector(0, 0, Math.PI)),
            ':inventory':   JSON.stringify(this.getDefaultInventory()),
            ':indicators':  JSON.stringify(this.getDefaultPlayerIndicators()),
            ':is_admin':    (world.info.user_id == player.session.user_id) ? 1 : 0
        });
        return await this.registerUser(world, player);
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
        const result = await this.db.run('UPDATE user SET pos = :pos, rotate = :rotate, dt_moved = :dt_moved, indicators = :indicators WHERE id = :id', {
            ':id':             player.session.user_id,
            ':pos':            JSON.stringify(player.state.pos),
            ':rotate':         JSON.stringify(player.state.rotate),
            ':indicators':     JSON.stringify(player.state.indicators),
            ':dt_moved':       ~~(Date.now() / 1000)
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

    // Load world chests
    async loadChests(world) {
        let resp = {
            list: new Map(),
            blocks: new VectorCollector() // Блоки занятые сущностями (содержат ссылку на сущность) Внимание! В качестве ключа используется сериализованные координаты блока
        };
        let rows = await this.db.all('SELECT x, y, z, dt, user_id, entity_id, item, slots FROM chest WHERE is_deleted = 0');
        for(let row of rows) {
            // EntityBlock
            let entity_block = {
                id:   row.entity_id,
                type: 'chest'
            };
            // slots
            let slots = JSON.parse(row.slots);
            // Block item
            let bi = JSON.parse(row.item);
            if(!('extra_data' in bi)) {
                bi.extra_data = {};
            }
            bi.extra_data.can_destroy = Object.entries(slots).length == 0;
            // chest
            let chest = new Chest(
                world,
                new Vector(row.x, row.y, row.z),
                row.user_id,
                new Date(row.dt * 1000).toISOString(),
                bi,
                slots
            );
            resp.list.set(row.entity_id, chest);
            resp.blocks.set(new Vector(row.x, row.y, row.z), entity_block);
        }
        return resp;
    }

    // Delete chest
    async deleteChest(entity_id) {
        const result = await this.db.run('UPDATE chest SET is_deleted = 1 WHERE entity_id = :entity_id', {
            ':entity_id': entity_id
        });
    }

    /**
     * Create chest
     * @param {ServerPlayer} player 
     * @param {Vector} pos 
     * @param {Object} params
     * @return {number}
     */
    async createChest(player, pos, params) {
        const result = await this.db.run('INSERT INTO chest(dt, user_id, entity_id, item, slots, x, y, z) VALUES(:dt, :user_id, :entity_id, :item, :slots, :x, :y, :z)', {
            ':user_id':         player.session.user_id,
            ':dt':              ~~(Date.now() / 1000),
            ':entity_id':       params.item.entity_id,
            ':item':            JSON.stringify(params.item),
            ':slots':           JSON.stringify(params.slots),
            ':x':               pos.x,
            ':y':               pos.y,
            ':z':               pos.z
        });
        return result.lastID;
    }

    /**
     * Create painting
     * @param {ServerWorld} world 
     * @param {ServerPlayer} player 
     * @param {Object} params
     * @return {number}
     */
    async createPainting(world, player, pos, params) {
        const result = await this.db.run('INSERT INTO painting(user_id, dt, params, x, y, z, entity_id, image_name, world_id) VALUES(:user_id, :dt, :params, :x, :y, :z, :entity_id, :image_name, :world_id)', {
            ':user_id':         player.session.user_id,
            ':dt':              ~~(Date.now() / 1000),
            ':params':          JSON.stringify(params),
            ':x':               pos.x,
            ':y':               pos.y,
            ':z':               pos.z,
            ':entity_id':       params.entity_id,
            ':image_name':      params.image_name,
            ':world_id':        world.info.id
        });
        return result.lastID;
    }

    // Load paintings
    async loadPaintings(addr, size) {
        let rows = await this.db.all('SELECT * FROM painting WHERE x >= :x_min AND x < :x_max AND y >= :y_min AND y < :y_max AND z >= :z_min AND z < :z_max', {
            ':x_min': addr.x * size.x,
            ':x_max': addr.x * size.x + size.x,
            ':y_min': addr.y * size.y,
            ':y_max': addr.y * size.y + size.y,
            ':z_min': addr.z * size.z,
            ':z_max': addr.z * size.z + size.z
        });
        let resp = new Map();
        for(let row of rows) {
            let item = JSON.parse(row.params);
            // pos:        new Vector(row.x, row.y, row.z),
            item.entity_id = row.entity_id;
            resp.set(item.entity_id, item);
        }
        return resp;
    }

    // saveChestSlots...
    async saveChestSlots(chest) {
        const result = await this.db.run('UPDATE chest SET slots = :slots WHERE entity_id = :entity_id', {
            ':slots':       JSON.stringify(chest.slots),
            ':entity_id':   chest.item.entity_id
        });
    }

    // ChunkBecameModified...
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

    // Create entity (mob)
    async createMob(params) {
        const entity_id = uuid();
        const result = await this.db.run('INSERT INTO entity(dt, entity_id, type, skin, indicators, rotate, x, y, z, pos_spawn) VALUES(:dt, :entity_id, :type, :skin, :indicators, :rotate, :x, :y, :z, :pos_spawn)', {
            ':dt':              ~~(Date.now() / 1000),
            ':entity_id':       entity_id,
            ':type':            params.type,
            ':skin':            params.skin,
            ':indicators':      JSON.stringify(params.indicators),
            ':rotate':          JSON.stringify(params.rotate),
            ':pos_spawn':       JSON.stringify(params.pos),
            ':x':               params.pos.x,
            ':y':               params.pos.y,
            ':z':               params.pos.z
        });
        return {
            id: result.lastID,
            entity_id: entity_id
        };
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

    // Load mobs
    async loadMobs(addr, size) {
        let rows = await this.db.all('SELECT * FROM entity WHERE x >= :x_min AND x < :x_max AND y >= :y_min AND y < :y_max AND z >= :z_min AND z < :z_max', {
            ':x_min': addr.x * size.x,
            ':x_max': addr.x * size.x + size.x,
            ':y_min': addr.y * size.y,
            ':y_max': addr.y * size.y + size.y,
            ':z_min': addr.z * size.z,
            ':z_max': addr.z * size.z + size.z
        });
        let resp = new Map();
        for(let row of rows) {
            let item = new Mob(this.world, {
                id:         row.id,
                rotate:     JSON.parse(row.rotate),
                pos_spawn:  JSON.parse(row.pos_spawn),
                pos:        new Vector(row.x, row.y, row.z),
                entity_id:  row.entity_id,
                type:       row.type,
                skin:       row.skin,
                indicators: JSON.parse(row.indicators)
            });
            resp.set(item.entity_id, item);
        }
        return resp;
    }

    // Save mob state
    async saveMob(mob) {
        const result = await this.db.run('UPDATE entity SET x = :x, y = :y, z = :z WHERE entity_id = :entity_id', {
            ':x': mob.pos.x,
            ':y': mob.pos.y,
            ':z': mob.pos.z,
            ':entity_id': mob.entity_id
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
        let rows = await this.db.all("SELECT x, y, z, params, 1 as power, entity_id, extra_data FROM world_modify WHERE id IN (select max(id) FROM world_modify WHERE x >= :x_min AND x < :x_max AND y >= :y_min AND y < :y_max AND z >= :z_min AND z < :z_max group by x, y, z)", {
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
            if('power' in item && item.power === 1) {
                delete(item.power);
            }
        }
        const result = await this.db.run('INSERT INTO world_modify(user_id, dt, world_id, params, x, y, z, entity_id, extra_data) VALUES (:user_id, :dt, :world_id, :params, :x, :y, :z, :entity_id, :extra_data)', {
            ':user_id':     player?.session.user_id || null,
            ':dt':          ~~(Date.now() / 1000),
            ':world_id':    world.info.id,
            ':params':      item ? JSON.stringify(item) : null,
            ':x':           params.pos.x,
            ':y':           params.pos.y,
            ':z':           params.pos.z,
            ':entity_id':   item?.entity_id ? item.entity_id : null,
            ':extra_data':  item?.extra_data ? JSON.stringify(item.extra_data) : null
        });
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

}