import {Vector, unixTime} from '@client/helpers.js';
import {DBGameSkins, UPLOAD_STARTING_ID} from './game/skin.js';

export class DBGame {
    conn: DBConnection;
    skins: DBGameSkins;

    constructor(conn: DBConnection) {
        this.conn = conn;
        this.skins = new DBGameSkins(this);
    }

    // Open database and return provider
    static async openDB(conn: DBConnection) {
        return await new DBGame(conn).applyMigrations();
    }

    // Migrations
    async applyMigrations() {

        let version = 0;

        try {
            // Read options
            let row = await this.conn.get('SELECT version FROM options');
            version = row.version;
        } catch(e) {
            await this.conn.get('begin transaction');
            await this.conn.get('CREATE TABLE "options" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "version" integer NOT NULL DEFAULT 0)');
            await this.conn.get('insert into options(version) values(0)');
            await this.conn.get('commit');
        }

        const migrations = [];
        migrations.push({version: 1, queries: [
            `UPDATE options set version = 1`,
            `CREATE TABLE "user_session" (
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "user_id" INTEGER NOT NULL,
                "dt" integer,
                "token" TEXT
            )`,
            `CREATE TABLE "world_player" (
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "world_id" INTEGER,
                "user_id" INTEGER,
                "dt" integer
            )`,
            `CREATE TABLE "user" (
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "guid" text NOT NULL,
                "username" TEXT,
                "dt" integer,
                "skin" TEXT,
                "password" TEXT
            )`,
            `CREATE TABLE "world" (
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "guid" text NOT NULL,
                "title" TEXT,
                "user_id" INTEGER,
                "dt" integer,
                "seed" TEXT,
                "generator" TEXT,
                "pos_spawn" TEXT
            )`,
            `INSERT INTO "world" ("id", "guid", "title", "user_id", "dt", "seed", "generator", "pos_spawn") VALUES (1, 'demo', '🤖 Demo public server', 1, 1633540804, 'undefined', '{"id":"biome2"}', '{"x":2895.7,"y":90,"z":2783.06}');`
        ]})

        migrations.push({version: 2, queries: [`CREATE TABLE "log" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "dt" integer NOT NULL,
            "event_name" TEXT,
            "data" TEXT
        );`]});
        migrations.push({version: 3, queries: [`alter table user add column "flags" INTEGER DEFAULT 0`]});

        migrations.push({version: 4, queries: [
            `ALTER TABLE "main"."world_player" RENAME TO "_world_player_old_20220515";`,
            `CREATE TABLE "main"."world_player" (
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "world_id" INTEGER,
                "user_id" INTEGER,
                "dt" integer,
                FOREIGN KEY ("world_id") REFERENCES "world" ("id") ON DELETE CASCADE ON UPDATE CASCADE
            );`,
            `INSERT INTO "main"."sqlite_sequence" (name, seq) VALUES ('world_player', '1059');`,
            `INSERT INTO "main"."world_player" ("id", "world_id", "user_id", "dt") SELECT "id", "world_id", "user_id", "dt" FROM "main"."_world_player_old_20220515";`,
            `DROP TABLE "main"."_world_player_old_20220515";`
        ]});

        migrations.push({version: 5, queries: [
            `ALTER TABLE "world" ADD COLUMN "play_count" integer NOT NULL DEFAULT 0;`,
            `ALTER TABLE "world_player" ADD COLUMN "play_count" integer NOT NULL DEFAULT 0;`
        ]});

        migrations.push({version: 6, queries: [
            `CREATE TABLE "main"."referrer" (
                "dt" text NOT NULL,
                "url" TEXT,
                "headers" TEXT
            );`
        ]});

        migrations.push({version: 7, queries: [
            `CREATE TABLE "screenshot" (
                "dt" integer,
                "guid_world" TEXT,
                "guid_file" TEXT
            );`
        ]});

        migrations.push({version: 8, queries: [
            `ALTER TABLE "world" ADD "cover" TEXT;`
        ]});

        migrations.push({version: 9, queries: [
            `ALTER TABLE world ADD COLUMN "game_mode" TEXT`,
            `UPDATE world set game_mode = 'survival'`
        ]});

        migrations.push({version: 10, queries: [
            `ALTER TABLE world_player ADD COLUMN dt_last_visit INTEGER NOT NULL DEFAULT 0`
        ]});

        migrations.push({version: 11, queries: [
            // change user.username COLLATE NOCASE
            `CREATE TABLE "user_copy" (
                "id"	INTEGER,
                "guid"	text NOT NULL,
                "username"	TEXT COLLATE NOCASE,
                "dt"	integer,
                "skin"	TEXT,
                "password"	TEXT,
                "flags"	INTEGER DEFAULT 0,
                PRIMARY KEY("id" AUTOINCREMENT))`,
            `INSERT INTO user_copy (id, guid, username, dt, skin, password, flags)
                SELECT id, guid, username, dt, skin, password, flags FROM user`,
            'DROP TABLE user',
            'ALTER TABLE user_copy RENAME TO user',
            `CREATE TABLE "world_copy" (
                "id"	INTEGER,
                "guid"	text NOT NULL,
                "title"	TEXT COLLATE NOCASE,
                "user_id"	INTEGER,
                "dt"	integer,
                "seed"	TEXT,
                "generator"	TEXT,
                "pos_spawn"	TEXT,
                "play_count"	integer NOT NULL DEFAULT 0,
                "cover"	TEXT,
                "game_mode"	TEXT,
                PRIMARY KEY("id" AUTOINCREMENT))`,
            `INSERT INTO world_copy (id, guid, title, user_id, dt, seed, generator, pos_spawn, play_count, cover, game_mode)
                SELECT id, guid, title, user_id, dt, seed, generator, pos_spawn, play_count, cover, game_mode FROM world`,
            'DROP TABLE world',
            'ALTER TABLE world_copy RENAME TO world',
            // new indices
            'CREATE UNIQUE INDEX user_username ON user (username)',
            'CREATE INDEX user_guid ON user (guid)',
            'CREATE INDEX user_session_token ON user_session (token)',
            'CREATE INDEX world_player_user_id_wrold_id ON world_player (user_id, world_id)',
            'CREATE INDEX world_guid ON world (guid)',
            'CREATE UNIQUE INDEX world_title ON world (title)'
        ]});

        migrations.push({version: 12, queries: [
            // hash
            `CREATE TABLE "skin" (
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "dt" INTEGER NOT NULL,
                "file" TEXT NOT NULL,       -- the file name relative to SKIN_ROOT, without an extension
                "type" INTEGER NOT NULL,
                "rights" INTEGER NOT NULL DEFAULT 0,
                "hash" TEXT,                -- base64url-encoded md5 of Buffer returned by Jimp bitmap.data
                "uploader_user_id" INTEGER,
                "original_name" TEXT    -- unused, but it may be useful to understand the uploaded skin, so we store it
            )`,
            'CREATE UNIQUE INDEX skin_hash_type ON skin (hash, type)',
            'CREATE INDEX skin_rights ON skin (rights)',
            // Reserve lower IDs for manualy added skins.
            // It's not a problem if we run out of low ids, just use the regular autoincrements
            `INSERT INTO sqlite_sequence (name, seq) VALUES ("skin", ${UPLOAD_STARTING_ID})`,
            `CREATE TABLE "user_skin" (
                "user_id" INTEGER NOT NULL,
                "skin_id" INTEGER NOT NULL,
                "dt" INTEGER NOT NULL,
                PRIMARY KEY("user_id", "skin_id")
            ) WITHOUT ROWID`,
            'CREATE INDEX user_skin_skin_id ON user_skin (skin_id)',
        ]});

        migrations.push({version: 13, queries: [
            `INSERT INTO "main"."world"("id", "guid", "title", "user_id", "dt", "seed", "generator", "pos_spawn", "play_count", "cover", "game_mode") VALUES (1000000, '3ee277a4-1834-4310-91da-389bf9c8demo', '⛰️ Demo 3D', 1, 1678641670, '1740540541', '{"id":"biome3","pos_spawn":{"x":0,"y":120,"z":0},"options":{"auto_generate_mobs":true,"keep_inventory_on_dead":true,"bonus_chest":false,"generate_bottom_caves_lava":false,"generate_big_caves":false,"generate_natural_slabs":true,"random_spawn_radius":50,"sapling_speed_multipliyer":1,"tool_durability":1,"tool_mining_speed":1},"rules":{"portals":true},"cluster_size":{"x":256,"y":200,"z":256}}', '{"x":0,"y":120,"z":0}', 1, NULL, 'survival');`,
            `INSERT INTO "main"."world"("id", "guid", "title", "user_id", "dt", "seed", "generator", "pos_spawn", "play_count", "cover", "game_mode") VALUES (1000001, 'd5d3520c-c6cb-4ef2-b439-d37df069demo', '☠️ Demo caves!', 1, 1678641670, '1740540541', '{"id":"biome3","pos_spawn":{"x":0,"y":120,"z":0},"options":{"auto_generate_mobs":true,"keep_inventory_on_dead":true,"bonus_chest":false,"generate_bottom_caves_lava":false,"generate_big_caves":false,"generate_natural_slabs":true,"random_spawn_radius":50,"sapling_speed_multipliyer":1,"tool_durability":1,"tool_mining_speed":1},"rules":{"portals":true},"cluster_size":{"x":256,"y":200,"z":256}}', '{"x":0,"y":120,"z":0}', 1, NULL, 'survival');`,
            `INSERT INTO "world_player"("world_id", "user_id", "dt") SELECT 1000000, "user".id, 1635956652 FROM "user"`,
            `INSERT INTO "world_player"("world_id", "user_id", "dt") SELECT 1000001, "user".id, 1635956652 FROM "user"`,
        ]});

        migrations.push({version: 14, queries: [
            `UPDATE world SET generator = replace(generator, '"generate_big_caves":false', '"generate_big_caves":true') WHERE _rowid_ = 1000001`,
        ]});

        for(let m of migrations) {
            if(m.version > version) {
                await this.conn.get('begin transaction');
                for(let query of m.queries) {
                    if (typeof query === 'string') {
                        await this.conn.get(query);
                    } else {
                        await query(this.conn);
                    }
                }
                await this.conn.get('update options set version = ' + (++version));
                await this.conn.get('commit');
                version = m.version;
                console.debug('Migration applied: ' + version);
            }
        }

        return this;

    }

    async LogAppend(event_name, data) {
        await this.conn.run('INSERT INTO log(dt, event_name, data) VALUES (:dt, :event_name, :data)', {
            ':dt':          unixTime(),
            ':event_name':  event_name,
            ':data':        data ? JSON.stringify(data, null, 2) : null
        });
    }

    async ReferrerAppend(url, headers) {
        await this.conn.run('INSERT INTO referrer(dt, url, headers) VALUES (:dt, :url, :headers)', {
            ':dt':          new Date().toISOString(),
            ':url':         url,
            ':headers':     JSON.stringify(headers, null, 2)
        });
    }

    // Создание нового мира (сервера)
    async Registration(username, password) {
        await this.conn.get('begin transaction');
        try {
            if(await this.conn.get("SELECT id, username, guid, password FROM user WHERE username = ?", [username])) {
                throw 'error_player_exists';
            }
            const guid = randomUUID();
            const result = await this.conn.run('INSERT OR IGNORE INTO user(dt, guid, username, password) VALUES (:dt, :guid, :username, :password)', {
                ':dt':          unixTime(),
                ':guid':        guid,
                ':username':    username,
                ':password':    password
            });
            // lastID
            let lastID = result.lastID;
            if(!result.changes) { // If it's a single-player, or insertion failed in multi-player
                const row = await this.conn.get('SELECT id AS lastID FROM user WHERE guid = :guid', {
                    ':guid': guid
                });
                if (!row) {
                    throw 'error_player_exists';
                }
                lastID = row.lastID;
            } else {
                if(lastID == 1) {
                    await this.conn.run('UPDATE user SET flags = 256 WHERE _rowid_ = :id', {
                        ':id': lastID
                    })
                }
            }
            //
            await this.JoinWorld(lastID, "demo")
            await this.JoinWorld(lastID, "d5d3520c-c6cb-4ef2-b439-d37df069demo")
            await this.JoinWorld(lastID, "3ee277a4-1834-4310-91da-389bf9c8demo")
            await this.conn.get('commit')
            return lastID
        } catch(e) {
            await this.conn.get('rollback')
            throw e
        }
    }

    // Login...
    async Login(username, password) {
        const result = await this.conn.get("SELECT id, username, guid, password FROM user WHERE username = ? and password = ?", [username, password]);
        if(!result) {
            throw 'error_invalid_login_or_password';
        }
        return this.CreatePlayerSession(result);
    }

    // GetPlayerSession...
    async GetPlayerSession(session_id) {
        const row = await this.conn.get('SELECT u.id, u.username, u.guid, u.flags FROM user_session s LEFT JOIN user u ON u.id = s.user_id WHERE token = :session_id LIMIT 1', {':session_id': session_id})
        if(!row) {
            throw 'error_invalid_session';
        }
        return {
            user_id:        row.id,
            user_guid:      row.guid,
            username:       row.username,
            flags:          row.flags,
            session_id:     session_id
        };
    }

    // Регистрация новой сессии пользователя
    async CreatePlayerSession(user_row) {
        const session_id = randomUUID();
        await this.conn.run('INSERT INTO user_session(dt, user_id, token) VALUES (:dt, :user_id, :session_id)', {
            ':dt':          unixTime(),
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
        const result = [];
        const rows = await this.conn.all("SELECT w.id, w.dt, w.user_id, w.guid, w.title, w.seed, w.generator, w.cover, w.game_mode FROM world_player AS wp LEFT JOIN world w ON w.id = wp.world_id WHERE wp.user_id = :user_id ORDER BY wp.dt_last_visit DESC, wp.id DESC", {
            ':user_id': user_id
        });
        if(rows) {
            for(let row of rows) {
                const cover = row.cover ? (row.cover + (row.cover.indexOf('.') > 0 ? '' : '.webp')) : null
                const cover_preview = cover ? (cover.startsWith('scr') ? `preview_${cover}` : null) : null
                const world = {
                    'id':           row.id,
                    'user_id':      row.user_id,
                    'dt':           new Date(row.dt * 1000).toISOString(), // '2021-10-06T19:20:04+02:00',
                    'guid':         row.guid,
                    'title':        row.title,
                    'seed':         row.seed,
                    'cover':        cover,
                    'cover_preview':cover_preview,
                    'game_mode':    row.game_mode,
                    'generator':    JSON.parse(row.generator),
                    'pos_spawn':    null,
                    'state':        null
                };
                result.push(world);
            }
        }
        return result;
    }

    // Delete world from my list
    async DeleteWorld(user_id, guid) {
        const row = await this.conn.get('SELECT id FROM world WHERE guid = :guid', {
            ':guid': guid
        });
        if(!row) {
            throw 'error_world_not_found';
        }
        const world_id = row.id;
        await this.conn.run('DELETE FROM world_player WHERE user_id = :user_id AND world_id = :world_id', {
            ':user_id': user_id,
            ':world_id': world_id
        });
        return true;
    }

    // Создание нового мира (сервера)
    async InsertNewWorld(user_id, generator, seed, title, game_mode) {
        // let worldWithSameTitle = await this.conn.get('SELECT title FROM world WHERE title = :title', { ':title': title});
        // if (worldWithSameTitle != null) {
        //     throw 'error_world_with_same_title_already_exist';
        // }
        const guid = randomUUID();
        let default_pos_spawn = generator.pos_spawn;
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
        const result = await this.conn.run('INSERT OR IGNORE INTO world(dt, guid, user_id, title, seed, generator, pos_spawn, game_mode) VALUES (:dt, :guid, :user_id, :title, :seed, :generator, :pos_spawn, :game_mode)', {
            ':dt':          unixTime(),
            ':guid':        guid,
            ':user_id':     user_id,
            ':title':       title,
            ':seed':        seed,
            ':game_mode':   game_mode,
            ':generator':   JSON.stringify(generator),
            ':pos_spawn':   JSON.stringify(default_pos_spawn)
        });
        // lastID
        let lastID = result.lastID;
        if(!result.changes) { // If it's a single-player, or insertion failed in multi-player
            const row = await this.conn.get('SELECT id AS lastID FROM world WHERE guid = :guid', {
                ':guid': guid
            });
            if (!row) {
                throw 'error_world_with_same_title_already_exist';
            }
            lastID = row.lastID;
        }
        //
        await this.InsertWorldPlayer(lastID, user_id);
        return {
            id:         lastID,
            guid:       guid,
            generator:  generator
        };
    }

    // Добавление игрока в мир
    async InsertWorldPlayer(world_id, user_id) {
        if(await this.PlayerExistsInWorld(world_id, user_id)) {
            throw 'error_player_exists_in_world';
        }
        const dt = unixTime();
        const result = await this.conn.run('INSERT INTO world_player(dt, world_id, user_id, dt_last_visit) VALUES (:dt, :world_id, :user_id, :dt_last_visit)', {
            ':dt':          dt,
            ':world_id':    world_id,
            ':user_id':     user_id,
            ':dt_last_visit': dt
        });
        // lastID
        let lastID = result.lastID;
        if(!result.lastID) {
            const row = await this.conn.get('SELECT id AS lastID FROM world_player WHERE user_id = :user_id', {
                ':user_id': user_id
            });
            lastID = row.lastID;
        }
        return lastID;
    }

    /**
     * Возвращает ID мира по его GUID
     */
    async getWorldID(world_guid: string): Promise<int> {
        const row = await this.conn.get("SELECT id FROM world WHERE guid = ?", [world_guid]);
        if(!row) {
            throw 'error_world_not_found';
        }
        return row.id;
    }

    async PlayerExistsInWorld(world_id, user_id) {
        const result = await this.conn.get("SELECT id FROM world_player WHERE world_id = ? and user_id = ?", [world_id, user_id]);
        return !!result;
    }

    // Присоединение к миру
    async JoinWorld(user_id, world_guid) {
        // 1. find world
        const world_id = await this.getWorldID(world_guid);
        if(await this.PlayerExistsInWorld(world_id, user_id)) {
            throw 'error_player_exists_in_selected_world';
        }
        // 3. insert player to world
        await this.InsertWorldPlayer(world_id, user_id)
        // 4. return WorldProperties
        const worlds = await this.MyWorlds(user_id)
        for(let world of worlds) {
            if (world.id == world_id) {
                return world
            }
        }
        throw 'error_world_player_not_found';
    }

    // getWorld... Возвращает мир по его GUID
    async getWorld(world_guid)  {
        const row = await this.conn.get("SELECT * FROM world WHERE guid = ?", [world_guid]);
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
            cover:      row.cover,
            generator:  JSON.parse(row.generator),
            pos_spawn:  JSON.parse(row.pos_spawn),
            state:      null
        };
    }

    // Increase world play count by user
    async IncreasePlayCount(world_id, session_id) {
        //
        const result = await this.conn.get(`UPDATE world_player
        SET play_count = play_count + 1, dt_last_visit = :dt_last_visit
        WHERE world_id = :world_id
        AND user_id = (SELECT user_id FROM user_session WHERE token = :session_id)`, {
            ':dt_last_visit': unixTime(),
            ':world_id':      world_id,
            ':session_id':    session_id
        });
        //
        await this.conn.get(`UPDATE world
        SET play_count = play_count + 1
        WHERE id = :world_id`, {
            ':world_id':      world_id
        });
        return !!result;
    }

    async InsertScreenshot(guid, cover) {
        const filename = 'scr' + randomUUID() + '.webp';
        // Проверям существование мира
        const row = await this.conn.get("SELECT * FROM world WHERE guid = ?", [guid]);
        if (!row) {
            return;
        }
        // Если это задний фон
        if(cover) {
            await this.conn.run('UPDATE world SET cover = :cover WHERE guid = :guid', {
                ':cover': filename,
                ':guid':  guid
            });
        }
        // Заносим в базу скриншот
        await this.conn.run('INSERT INTO screenshot (dt, guid_world, guid_file) VALUES (:dt, :guid, :file)', {
            ':dt':  unixTime(),
            ':guid': guid,
            ':file': filename
        });
        return filename;
    }

}