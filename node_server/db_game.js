import path from 'path'
import sqlite3 from 'sqlite3'
import {open} from 'sqlite'
import uuid from 'uuid';
import { copyFile } from 'fs/promises';

import {Vector} from '../www/js/helpers.js';

export class DBGame {

    static TEMPLATE_DB = './game.sqlite3.template';

    constructor(db) {
        this.db = db;
    }

    // Open database and return provider
    static async openDB(dir) {
        let filename = dir + '/game.sqlite3';
        filename = path.resolve(filename);
        // Check directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        // Recheck directory exists
        if (!fs.existsSync(dir)) {
            throw 'Game directory not found: ' + dir;
        }
        // If DB file not exists, then create it from template
        if (!fs.existsSync(filename)) {
            // create db from template
            let template_db_filename = path.resolve(DBGame.TEMPLATE_DB);
            await copyFile(template_db_filename, filename);
        }
        // Open SQLIte3 fdatabase file
        let dbc = await open({
            filename: filename,
            driver: sqlite3.Database
        }).then(async (conn) => {
            return new DBGame(conn);
        });
        await dbc.applyMigrations();
        return dbc;
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
            await this.db.get('update options set version = 1');
            await this.db.get('commit');
            version++;
        }
    }

    // Создание нового мира (сервера)
    async Registration(username, password) {
        if(await this.db.get("SELECT id, username, guid, password FROM user WHERE LOWER(username) = ?", [username.toLowerCase()])) {
            throw 'error_player_exists';
        }
        const guid = uuid();
        const result = await this.db.run('INSERT INTO user(dt, guid, username, password) VALUES (:dt, :guid, :username, :password)', {
            ':dt':          ~~(Date.now() / 1000),
            ':guid':        guid,
            ':username':    username,
            ':password':    password
        });
        let user_id = result.lastID;
        await this.JoinWorld(user_id, "demo")
        return user_id;
    }

    // Login...
    async Login(username, password) {
        const result = await this.db.get("SELECT id, username, guid, password FROM user WHERE username = ? and password = ?", [username, password]);
        if(!result) {
            throw 'error_invalid_login_or_password';
        }
        return this.CreatePlayerSession(result);
    }

    // GetPlayerSession...
    async GetPlayerSession(session_id) {
        let row = await this.db.get('SELECT u.id, u.username, u.guid FROM user_session s LEFT JOIN user u ON u.id = s.user_id WHERE token = ? LIMIT 1', session_id)
        if(!row) {
            throw 'error_invalid_session';
        }
        return {
            user_id:        row.id,
            user_guid:      row.guid,
            username:       row.username,
            session_id:     session_id
        };
    }

    // Регистрация новой сессии пользователя
    async CreatePlayerSession(user_row) {
        const session_id = uuid();
        const result = await this.db.run('INSERT INTO user_session(dt, user_id, token) VALUES (:dt, :user_id, :session_id)', {
            ':dt':          ~~(Date.now() / 1000),
            ':user_id':     user_row.id,
            ':session_id':  session_id
        });
        return {
            user_id:        user_row.id,
            user_guid:      user_row.guid,
            username:       user_row.username,
            session_id:     session_id
        };
    }

    // Возвращает все сервера созданные мной и те, которые я себе добавил
    async MyWorlds(user_id) {
        let result = [];
        let rows = await this.db.all("SELECT w.id, w.dt, w.user_id, w.guid, w.title, w.seed, w.generator FROM world_player AS wp LEFT JOIN world w ON w.id = wp.world_id WHERE wp.user_id = ?", user_id)
        if(rows) {
            for(let row of rows) {
                let world = {
                    'id':           row.id,
                    'user_id':      row.user_id,
                    'dt':           '2021-10-06T19:20:04+02:00',
                    'guid':         row.guid,
                    'title':        row.title,
                    'seed':         row.seed,
                    'game_mode':    '',
                    'generator':    JSON.parse(row.generator),
                    'pos_spawn':    null,
                    'state':        null
                };
                result.push(world);
            }
        }
        return result;
    }

    // Создание нового мира (сервера)
    async InsertNewWorld(user_id, generator, seed, title, game_mode) {
        const guid = uuid();
        let default_pos_spawn = new Vector(2895.7, 120, 2783.06);
        switch(generator?.id) {
            case 'city':
            case 'flat': {
                default_pos_spawn = new Vector(0, 2, 0);
                break;
            }
            case 'city2': {
                default_pos_spawn = new Vector(3000, 8, 3000);
                break;
            }
        }
        const result = await this.db.run('INSERT INTO world(dt, guid, user_id, title, seed, generator, pos_spawn) VALUES (:dt, :guid, :user_id, :title, :seed, :generator, :pos_spawn)', {
            ':dt':          ~~(Date.now() / 1000),
            ':guid':        guid,
            ':user_id':     user_id,
            ':title':       title,
            ':seed':        seed,
            ':generator':   JSON.stringify(generator),
            ':pos_spawn':   JSON.stringify(default_pos_spawn)
        });
        let world_id = result.lastID;
        await this.InsertWorldPlayer(world_id, user_id);
        return {
            id:         world_id,
            guid:       guid,
            generator:  generator
        };
    }

    // Добавление игрока в мир
    async InsertWorldPlayer(world_id, user_id) {
        if(await this.PlayerExistsInWorld(world_id, user_id)) {
            throw 'error_player_exists_in_world';
        }
        const result = await this.db.run('INSERT INTO world_player(dt, world_id, user_id) VALUES (:dt, :world_id, :user_id)', {
            ':dt':          ~~(Date.now() / 1000),
            ':world_id':    world_id,
            ':user_id':     user_id
        });
        return result.lastID;
    }

    // getWorldID... Возвращает ID мира по его GUID
    async getWorldID(world_guid) {
        let row = await this.db.get("SELECT id FROM world WHERE guid = ?", [world_guid]);
        if(!row) {
            throw 'error_world_not_found';
        }
        return row.id;
    }

    async PlayerExistsInWorld(world_id, user_id) {
        const result = await this.db.get("SELECT id FROM world_player WHERE world_id = ? and user_id = ?", [world_id, user_id]);
        return !!result;
    }

    // Присоединение к миру
    async JoinWorld(user_id, world_guid) {
        // 1. find world
        let world_id = await this.getWorldID(world_guid);
        if(await this.PlayerExistsInWorld(world_id, user_id)) {
            throw 'error_player_exists_in_selected_world';
        }
        // 3. insert player to world
        await this.InsertWorldPlayer(world_id, user_id)
        // 4. return WorldProperties
        let worlds = await this.MyWorlds(user_id)
        for(let world of worlds) {
            if (world.id == world_id) {
                return world
            }
        }
        throw 'error_world_player_not_found';
    }

    // getWorld... Возвращает мир по его GUID
    async getWorld(world_guid)  {
        let row = await this.db.get("SELECT * FROM world WHERE guid = ?", [world_guid]);
        if(!row) {
            throw 'error_world_not_found';
        }
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
        };
    }

}