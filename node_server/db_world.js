import path from 'path'
import sqlite3 from 'sqlite3'
import {open} from 'sqlite'
import uuid from 'uuid';
import { copyFile } from 'fs/promises';

import {Vector} from "../www/js/helpers.js";

export class DBWorld {

    static TEMPLATE_DB = './world.sqlite3.template';

    constructor(db, world) {
        this.db = db;
        this.world = world;
    }

    // OpenDB
    static async OpenDB(dir, world) {
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
        await dbc.ApplyMigrations();
        return dbc;
    }

    // Возвращает мир по его GUID либо создает и возвращает его
    async GetWorld(world_guid) {
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
        let world = await Game.Db.GetWorld(world_guid);
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
        return this.GetWorld(world_guid);
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

    async RegisterUser(world, player) {
        // Find existing world record
        let row = await this.db.get("SELECT id, inventory, pos, pos_spawn, rotate, indicators FROM user WHERE guid = ?", [player.session.user_guid]);
        if(row) {
            return {
                pos:                JSON.parse(row.pos),
                pos_spawn:          JSON.parse(row.pos_spawn),
                rotate:             JSON.parse(row.rotate),
                inventory:          JSON.parse(row.inventory),
                indicators:         JSON.parse(row.indicators),
                chunk_render_dist:  4
            };
        }
        let default_pos_spawn = world.info.pos_spawn;
        let rotate = new Vector(0, 0, Math.PI);
        // Inventory
        let default_inventory = {
            items:   [],
            current: {index: 0}
        }
        // Indicators
        let default_indicators = this.getDefaultPlayerIndicators()
        //
        let is_admin = 0;
        if (world.info.user_id == player.session.user_id) {
            is_admin = 1;
        }
        // Insert to DB
        const result = await this.db.run('INSERT INTO user(id, guid, username, dt, pos, pos_spawn, rotate, inventory, indicators, is_admin) VALUES(:id, :guid, :username, :dt, :pos, :pos_spawn, :rotate, :inventory, :indicators, :is_admin)', {
            ':id':          player.session.user_id,
            ':guid':        player.session.user_guid,
            ':username':    player.session.username,
            ':dt':          ~~(Date.now() / 1000),
            ':pos':         JSON.stringify(default_pos_spawn),
            ':pos_spawn':   JSON.stringify(default_pos_spawn),
            ':rotate':      JSON.stringify(rotate),
            ':inventory':   JSON.stringify(default_inventory),
            ':indicators':  JSON.stringify(default_indicators),
            ':is_admin':    is_admin,
        });
        return await this.RegisterUser(world, player);
    }

    async ApplyMigrations() {
        
        let version = 0;

        try {
            // Read options
            let row = await this.db.get('SELECT version FROM options');
            version = row.version;
        } catch(e) {
            await this.db.get('CREATE TABLE "options" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "version" integer NOT NULL DEFAULT 0)');
            await this.db.get('insert into options(version) values(0)');
        }

        // Version 0 -> 1
        if (version == 0) {
            let default_indicators = this.getDefaultPlayerIndicators();
            await this.db.get('alter table user add column indicators text');
            await this.db.run('UPDATE user SET indicators = :indicators', {
                ':indicators':  JSON.stringify(default_indicators),
            });
            await this.db.get('update options set version = 1');
            version++;
        }
        
        // Version 1 -> 2
        if (version == 1) {
            await this.db.get('alter table user add column is_admin integer default 0');
            await this.db.get('update user set is_admin = 1 where id in (select user_id from world)');
            await this.db.get('update options set version = 2');
            version++;
        }

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
        const result = await this.db.run('UPDATE user SET pos_spawn = :pos_spawn WHERE id = :id', {
            ':id':             player.session.user_id,
            ':pos_spawn':      JSON.stringify(params.pos)
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
    async loadWorldChests(world) {
        let resp = {
            chests: new Map(),
            blocks: new Map() // Блоки занятые сущностями (содержат ссылку на сущность) Внимание! В качестве ключа используется сериализованные координаты блока
        };
        let rows = await this.db.all('SELECT x, y, z, dt, user_id, entity_id, item, slots FROM chest');
        for(let row of rows) {
            // EntityBlock
            let entity_block = {
                id:   row.entity_id,
                type: 'chest'
            };
            // Block item
            let bi = JSON.parse(row.item);
            // slots
            let slots = JSON.parse(row.slots);
            // chest
            let chest = {
                user_id: row.user_id,                           // Кто автор
                time:    new Date(row.dt * 1000).toISOString(), // Время создания, time.Now()
                item:    bi,                                    // Предмет
                slots:   slots,                                 // Слоты
            };
            let pos_string = row.x + ',' + row.y + ',' + row.z;
            resp.chests.set(row.entity_id, chest);
            resp.blocks.set(pos_string, entity_block);
        }
        return resp;

    }

    // Create chest...
    createChest(player, pos, chest) {
        /*
        query := `INSERT INTO chest(dt, user_id, entity_id, item, slots, x, y, z) VALUES($1, $2, $3, $4, $5, $6, $7, $8)`
        statement, err := this.Conn.Prepare(query) // Prepare statement. This is good to avoid SQL injections
        if err != nil {
            log.Printf("SQL_ERROR44: %v", err)
        }
        item_json_bytes, _ := json.Marshal(chest.Item)
        slots_json_bytes, _ := json.Marshal(chest.Slots)
        _, err = statement.Exec(time.Now().Unix(), conn.Session.UserID, chest.Item.EntityID, string(item_json_bytes), string(slots_json_bytes), pos.X, pos.Y, pos.Z)
        if err != nil {
            log.Printf("SQL_ERROR45: %v", err)
        }
        return err
        */
    }

    // saveChestSlots...
    saveChestSlots(chest) {
        /*
        query := `UPDATE chest SET slots = $1 WHERE entity_id = $2`
        statement, err := this.Conn.Prepare(query) // Prepare statement. This is good to avoid SQL injections
        if err != nil {
            log.Printf("SQL_ERROR46: %v", err)
        }
        slots_json_bytes, _ := json.Marshal(chest.Slots)
        _, err = statement.Exec(string(slots_json_bytes), chest.Item.EntityID)
        if err != nil {
            log.Printf("SQL_ERROR47: %v", err)
        }
        return err
        */
    }

}