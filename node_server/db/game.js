import {Vector} from '../../www/js/helpers.js';

export class DBGame {

    constructor(conn) {
        this.conn = conn;
    }

    // Open database and return provider
    static async openDB(conn) {
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
        
        for(let m of migrations) {
            if(m.version > version) {
                await this.conn.get('begin transaction');
                for(let query of m.queries) {
                    await this.conn.get(query);
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
            ':dt':          ~~(Date.now() / 1000),
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
        if(await this.conn.get("SELECT id, username, guid, password FROM user WHERE LOWER(username) = ?", [username.toLowerCase()])) {
            throw 'error_player_exists';
        }
        const guid = randomUUID();
        const result = await this.conn.run('INSERT INTO user(dt, guid, username, password) VALUES (:dt, :guid, :username, :password)', {
            ':dt':          ~~(Date.now() / 1000),
            ':guid':        guid,
            ':username':    username,
            ':password':    password
        });
        // lastID
        let lastID = result.lastID;
        if(!lastID) {
            const row = await this.conn.get('SELECT id AS lastID FROM user WHERE guid = :guid', {
                ':guid': guid
            });
            lastID = row.lastID;
        }
        //
        await this.JoinWorld(lastID, "demo")
        return lastID;
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
        const result = [];
        const rows = await this.conn.all("SELECT w.id, w.dt, w.user_id, w.guid, w.title, w.seed, w.generator, w.cover FROM world_player AS wp LEFT JOIN world w ON w.id = wp.world_id WHERE wp.user_id = :user_id ORDER BY wp.play_count DESC, wp.id DESC", {
            ':user_id': user_id
        });
        if(rows) {
            for(let row of rows) {
                const world = {
                    'id':           row.id,
                    'user_id':      row.user_id,
                    'dt':           '2021-10-06T19:20:04+02:00',
                    'guid':         row.guid,
                    'title':        row.title,
                    'seed':         row.seed,
                    'cover':        row.cover ? (row.cover + (row.cover.indexOf('.') > 0 ? '' : '.webp')) : null,
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
    }

    // Создание нового мира (сервера)
    async InsertNewWorld(user_id, generator, seed, title, game_mode) {
        const guid = randomUUID();
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
        const result = await this.conn.run('INSERT INTO world(dt, guid, user_id, title, seed, generator, pos_spawn) VALUES (:dt, :guid, :user_id, :title, :seed, :generator, :pos_spawn)', {
            ':dt':          ~~(Date.now() / 1000),
            ':guid':        guid,
            ':user_id':     user_id,
            ':title':       title,
            ':seed':        seed,
            ':generator':   JSON.stringify(generator),
            ':pos_spawn':   JSON.stringify(default_pos_spawn)
        });
        // lastID
        let lastID = result.lastID;
        if(!lastID) {
            const row = await this.conn.get('SELECT id AS lastID FROM world WHERE guid = :guid', {
                ':guid': guid
            });
            lastID = row.lastID;
        }
        lastID = parseInt(lastID);
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
        const result = await this.conn.run('INSERT INTO world_player(dt, world_id, user_id) VALUES (:dt, :world_id, :user_id)', {
            ':dt':          ~~(Date.now() / 1000),
            ':world_id':    world_id,
            ':user_id':     user_id
        });
        // lastID
        let lastID = result.lastID;
        if(!lastID) {
            const row = await this.conn.get('SELECT id AS lastID FROM world_player WHERE user_id = :user_id', {
                ':user_id': user_id
            });
            lastID = row.lastID;
        }
        lastID = parseInt(lastID);
        return lastID;
    }

    // getWorldID... Возвращает ID мира по его GUID
    async getWorldID(world_guid) {
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
            generator:  JSON.parse(row.generator),
            pos_spawn:  JSON.parse(row.pos_spawn),
            state:      null
        };
    }

    // Increase world play count by user
    async IncreasePlayCount(world_id, session_id) {
        //
        const result = await this.conn.get(`UPDATE world_player
        SET play_count = play_count + 1
        WHERE world_id = :world_id
        AND user_id = (SELECT user_id FROM user_session WHERE token = :session_id)`, {
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
        const file = randomUUID() + '.webp';
        //Проверям существование мира
        const row = await this.conn.get("SELECT * FROM world WHERE guid = ?", [guid]);
        if (!row) {
            return;
        }
        //Если это задний фон
        if (cover) {
            const result = await this.conn.run('UPDATE world SET cover = :cover WHERE guid = :guid', {
                ':cover': file,
                ':guid':  guid
            });
        }
        //Заносим в базу скриншот
        const result = await this.conn.run('INSERT INTO screenshot (dt, guid_world, guid_file) VALUES (:dt, :guid, :file)', {
            ':dt':   ~~(Date.now() / 1000),
            ':guid': guid,
            ':file': file
        });
        return file;
    }

}