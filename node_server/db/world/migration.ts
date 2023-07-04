import {BLOCK_IDS, DEFAULT_RENDER_DISTANCE, INVENTORY_SLOT_COUNT, PAPERDOLL_BACKPACK, PAPERDOLL_TOOLBELT} from "@client/constant.js";
import type { Indicators } from "@client/player.js";
import type { ServerWorld } from "../../server_world.js";
import { OLD_CHUNK_SIZE } from "@client/chunk_const.js";
import { Vector } from "@client/helpers.js";
import type {TInventoryState} from "@client/inventory.js";
import {preprocessSQL, run} from "../db_helpers.js";

/* Как делать миграцию блоков.

Пример: у блоков в мире (не в инвентаре) с id = 999 удалить поле extra_data.foo и добавить им extra_data.bar = 10.
1. Удалить все записи из world_modify_chunks. После запуска мира они будут автоматически созданы заново.
  DELETE FROM world_modify_chunks;
2. Изменить все блоки в world_modify: world_modify.params, а также отдельно храняющиеся поля, например:
  UPDATE world_modify
  SET params = json_patch(params, '{"extra_data": {"foo": null, "bar": 10} }'),
    extra_data = json_patch(extra_data, '{"foo": null, "bar": 10}')
  WHERE block_id = 999;

Если нужно делать миграцию предметов, то нужно менять еще инвентари игроков и содержимое сундуков.

TODO: удалить устаревшие поля. Они остаются на некоторое время чтобы старые версии могли открывать БД.
Устарели 05.06.2023 в quest_action (включены в params): block_id, cnt, pos.
Устарели до 05.06.2023 в user (включены в state), но возможно где-то еще используются, надо проверить код: indicators,
  pos_spawn, pos, rotate, chunk_render_dist, game_mode, stats.
Есть дублирующиеся поля в таблице world_modify.
*/

// Migrations
export class DBWorldMigration {
    db: DBConnection;
    world: ServerWorld;
    getDefaultPlayerStats: any;
    getDefaultPlayerIndicators: () => Indicators;

    constructor(db: DBConnection, world: ServerWorld, getDefaultPlayerStats, getDefaultPlayerIndicators: () => Indicators) {
        this.db = db;
        this.world = world;
        this.getDefaultPlayerStats = getDefaultPlayerStats;
        this.getDefaultPlayerIndicators = getDefaultPlayerIndicators;
    }

    //
    async apply() {

        let version = 0

        // Read options
        const table_exists = await this.db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='options'`);
        if(table_exists) {
            const row = await this.db.get('SELECT version FROM options');
            version = row.version;
        } else {
            await this.db.get('BEGIN TRANSACTION');
            await this.db.get('CREATE TABLE "options" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "version" integer NOT NULL DEFAULT 0)');
            await this.db.get('INSERT INTO options(version) values(0)');
            await this.db.get('COMMIT');
        }

        //
        const update_world_modify_chunks = async () : Promise<string[]> => {

            // check worlds count in database
            const row_worlds = await this.db.get(`SELECT count(*) cnt FROM world`)
            if(!row_worlds || row_worlds.cnt > 1) {
                throw 'error_allow_only_one_world_per_database'
            }
  
            // get actual chunk size
            const csz = new Vector().copyFrom(OLD_CHUNK_SIZE)
            const field_exists = await this.db.get(`SELECT * FROM pragma_table_info('world') WHERE name='tech_info'`)
            if(field_exists) {
                const row = await this.db.get('SELECT tech_info FROM world')
                if(row) {
                    const tech_info = JSON.parse(row.tech_info)
                    if(tech_info?.chunk_size) {
                        csz.copyFrom(tech_info.chunk_size)
                    }
                }
            }

            return [`
            UPDATE world_modify
            SET
            chunk_x = cast(floor(cast(x as float) / ${csz.x}.) as integer),
            chunk_y = cast(floor(cast(y as float) / ${csz.y}.) as integer),
            chunk_z = cast(floor(cast(z as float) / ${csz.z}.) as integer),
                "index" =
                    (${csz.x}. * ${csz.z}.) *
                        ((y - floor(cast(y as float) / ${csz.y}.) * ${csz.y}.) % ${csz.y}.) +
                        (((z - floor(cast(z as float) / ${csz.z}.) * ${csz.z}.) % ${csz.z}.) * ${csz.x}.) +
                        ((x - floor(cast(x as float) / ${csz.x}.) * ${csz.x}.) % ${csz.x}.);`,

            `DELETE FROM world_modify_chunks;`,

            `WITH chunks AS (select distinct chunk_x, chunk_y, chunk_z from world_modify)
            INSERT INTO world_modify_chunks(x, y, z, data)
            select chunk_x, chunk_y, chunk_z, (SELECT
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
            FROM world_modify m WHERE m.chunk_x = o.chunk_x AND m.chunk_y = o.chunk_y AND m.chunk_z = o.chunk_z
            ORDER BY m.id ASC)
            FROM chunks o`];
        }

        //
        const migrations = [];
        migrations.push({version: 1, queries: [
            `CREATE TABLE "user_session"(
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "user_id" INTEGER NOT NULL,
                "dt" integer,
                "token" TEXT
            )`,
            `CREATE TABLE "chat_message"(
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "user_id" integer NOT NULL,
                "dt" integer NOT NULL,
                "text" TEXT,
                "world_id" INTEGER,
                "user_session_id" INTEGER
            )`,
            `CREATE TABLE "user"(
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "guid" text NOT NULL,
                "username" TEXT,
                "inventory" TEXT,
                "indicators" TEXT,
                "dt" integer,
                "pos_spawn" TEXT,
                "pos" TEXT,
                "rotate" TEXT,
                "dt_moved" integer
            )`,
            `CREATE TABLE "world"(
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "guid" text NOT NULL,
                "title" TEXT,
                "user_id" INTEGER,
                "dt" integer,
                "seed" TEXT,
                "generator" TEXT,
                "pos_spawn" TEXT
            )`,
            `CREATE TABLE "chest"(
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "dt" integer,
                "user_id" INTEGER NOT NULL,
                "entity_id" TEXT NOT NULL,
                "item" TEXT NOT NULL,
                "slots" TEXT NOT NULL,
                "x" integer,
                "y" integer,
                "z" integer
            )`,
            `CREATE TABLE "world_modify"(
                "id" INTEGER,
                "world_id" INTEGER NOT NULL,
                "dt" integer,
                "user_id" INTEGER,
                "params" TEXT,
                "user_session_id" INTEGER,
                "x" integer NOT NULL,
                "y" integer NOT NULL,
                "z" integer NOT NULL,
                "entity_id" text,
                "extra_data" text,
                PRIMARY KEY("id"),
                UNIQUE("entity_id") ON CONFLICT ABORT
            )`,
            {
                sql: 'UPDATE user SET indicators = :indicators',
                placeholders: {
                    ':indicators':  JSON.stringify(this.getDefaultPlayerIndicators()),
                }
            }
        ]});
        migrations.push({version: 2, queries: [
            'alter table user add column is_admin integer default 0',
            'update user set is_admin = 1 where id in (select user_id from world)',
        ]});
        migrations.push({version: 3, queries: [
            `CREATE TABLE "entity" (
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
              )`
        ]});
        migrations.push({version: 4, queries: [
            `alter table world add column "game_mode" TEXT DEFAULT 'survival'`,
            `alter table user add column "chunk_render_dist" integer DEFAULT ${DEFAULT_RENDER_DISTANCE}`
        ]});
        migrations.push({version: 5, queries: [
            `CREATE INDEX "world_modify_xyz" ON "world_modify" ("x", "y", "z")`,
        ]});
        migrations.push({version: 6, queries: [
            `update world_modify set params = replace(replace(replace(replace(replace(replace(replace(params,',"rotate":{"x":0,"y":0,"z":0}', ''), ',"entity_id":""', ''), ',"entity_id":null', ''), ',"extra_data":null', ''), ',"power":1', ''), '{"id":0}', ''), '{}', '') where params is not null`,
            `update world_modify set params = null where params is not null and params = ''`,
            `update world_modify set params = '{"id":2}' where params is not null and params like '{"id":2,%'`
        ]});
        migrations.push({version: 7, queries: [
            `update world_modify set params = '{"id":50,"rotate":{"x":0,"y":1,"z":0}}' where params is not null and params like '{"id":50,%'`
        ]});
        migrations.push({version: 8, queries: [
            `alter table entity add column "pos_spawn" TEXT NOT NULL DEFAULT ''`,
            `update entity set pos_spawn = '{"x":' || x || ',"y":' || y || ',"z":' || z || '}' where pos_spawn = '';`
        ]});
        migrations.push({version: 9, queries: [
            `alter table chest add column "is_deleted" integer DEFAULT 0`
        ]});
        migrations.push({version: 10, queries: [
            `CREATE TABLE "drop_item" (
                "id" INTEGER NOT NULL,
                "dt" integer,
                "entity_id" TEXT,
                "items" TEXT,
                "x" real,
                "y" real,
                "z" real,
                PRIMARY KEY ("id")
              )`,
            ]});
        migrations.push({version: 11, queries: [
            `DROP INDEX "main"."world_modify_xyz";`,
            //
            `ALTER TABLE "main"."world_modify" RENAME TO "_world_modify_old_20211227";`,
            //
            `CREATE TABLE "main"."world_modify" (
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
              );`,
            //
            `INSERT INTO "main"."world_modify" ("id", "world_id", "dt", "user_id", "params", "user_session_id", "x", "y", "z", "entity_id", "extra_data") SELECT "id", "world_id", "dt", "user_id", "params", "user_session_id", "x", "y", "z", "entity_id", "extra_data" FROM "main"."_world_modify_old_20211227";`,
            //
            `CREATE INDEX "main"."world_modify_xyz" ON "world_modify" ("x" ASC, "y" ASC, "z" ASC);`,
            `DROP TABLE "_world_modify_old_20211227"`
        ]});
        migrations.push({version: 12, queries: [`alter table drop_item add column "is_deleted" integer DEFAULT 0`]});
        migrations.push({version: 13, queries: [`alter table user add column "game_mode" TEXT DEFAULT NULL`]});
        migrations.push({version: 14, queries: [`UPDATE user SET inventory = replace(inventory, '"index2":0', '"index2":-1')`]});
        migrations.push({version: 15, queries: [`UPDATE entity SET x = json_extract(pos_spawn, '$.x'), y = json_extract(pos_spawn, '$.y'), z = json_extract(pos_spawn, '$.z')`]});
        migrations.push({version: 16, queries: [
            `CREATE TABLE "painting" (
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
            );`
        ]});
        migrations.push({version: 17, queries: [`alter table world_modify add column "ticks" INTEGER DEFAULT NULL`]});
        migrations.push({version: 18, queries: [`UPDATE world_modify SET params = '{"id":612}' WHERE params = '{"id":141}';`]});
        migrations.push({version: 19, queries: [`UPDATE world_modify SET extra_data = '{"stage":0}' WHERE params = '{"id":59}' OR params LIKE '{"id":59,%';`]});
        migrations.push({version: 20, queries: [
            `DELETE FROM world_modify WHERE params = '{"id":75}' OR params LIKE '{"id":75,%';`,
            `DELETE FROM world_modify WHERE params = '{"id":76}' OR params LIKE '{"id":76,%';`
        ]});
        migrations.push({version: 21, queries: [
            `UPDATE user SET pos_spawn = (SELECT pos_spawn FROM world) WHERE ABS(json_extract(pos_spawn, '$.x')) > 2000000000 OR ABS(json_extract(pos_spawn, '$.y')) > 2000000000 OR ABS(json_extract(pos_spawn, '$.z')) > 2000000000`,
            `UPDATE user SET pos = pos_spawn WHERE ABS(json_extract(pos, '$.x')) > 2000000000 OR ABS(json_extract(pos, '$.y')) > 2000000000 OR ABS(json_extract(pos, '$.z')) > 2000000000`
        ]});
        migrations.push({version: 22, queries: [`alter table world add column "add_time" INTEGER DEFAULT 7000`]});
        migrations.push({version: 23, queries: [
            `UPDATE world_modify SET params = '{"id":365}' WHERE params LIKE '{"id":350%';`,
            `UPDATE world_modify SET params = '{"id":361}' WHERE params LIKE '{"id":351%';`,
            `UPDATE world_modify SET params = '{"id":362}' WHERE params LIKE '{"id":352%';`,
            `UPDATE world_modify SET params = '{"id":359}' WHERE params LIKE '{"id":353%';`,
            `UPDATE world_modify SET params = '{"id":357}' WHERE params LIKE '{"id":354%';`,
            `UPDATE world_modify SET params = '{"id":363}' WHERE params LIKE '{"id":355%';`,
            `UPDATE world_modify SET params = '{"id":364}' WHERE params LIKE '{"id":502%';`,
            `UPDATE world_modify SET params = '{"id":354}' WHERE params LIKE '{"id":506%';`,
        ]});
        migrations.push({version: 24, queries: [
            `UPDATE entity SET skin = 'base' WHERE type = 'axolotl' and skin = 'blue'`,
        ]});
        migrations.push({version: 25, queries: [
            `UPDATE user SET game_mode = 'survival' WHERE game_mode IS NOT NULL AND is_admin = 0`,
        ]});
        migrations.push({version: 26, queries: [
            `UPDATE world_modify set params = '{"id": 3}' where  params like '{"id":3,"rotate":{"x":-%'`,
        ]});
        migrations.push({version: 27, queries: [
            `CREATE TABLE "quest" ("id" INTEGER NOT NULL, "quest_group_id" INTEGER NOT NULL, "title" TEXT NOT NULL, "description" TEXT, PRIMARY KEY ("id"));`,
            `CREATE TABLE "quest_action" ("id" INTEGER NOT NULL, "quest_id" INTEGER NOT NULL, "quest_action_type_id" INTEGER, "block_id" INTEGER, "cnt" integer, "pos" TEXT, "description" TEXT, PRIMARY KEY ("id"));`,
            `CREATE TABLE "quest_action_type" ("id" INTEGER NOT NULL, "title" TEXT, PRIMARY KEY ("id"));`,
            `INSERT INTO "quest_action_type" VALUES (1, 'Добыть');`,
            `INSERT INTO "quest_action_type" VALUES (2, 'Скрафтить');`,
            `INSERT INTO "quest_action_type" VALUES (3, 'Установить блок');`,
            `INSERT INTO "quest_action_type" VALUES (4, 'Использовать инструмент');`,
            `INSERT INTO "quest_action_type" VALUES (5, 'Достигнуть координат');`,
            `CREATE TABLE "quest_group" ("id" INTEGER NOT NULL, "title" TEXT, PRIMARY KEY ("id"));`,
            `CREATE TABLE "quest_reward" ("id" INTEGER NOT NULL, "quest_id" INTEGER NOT NULL, "block_id" INTEGER NOT NULL, "cnt" TEXT NOT NULL, PRIMARY KEY ("id"));`,
            `CREATE TABLE "user_quest" ("id" INTEGER NOT NULL, "dt" TEXT, "user_id" INTEGER NOT NULL, "quest_id" INTEGER NOT NULL, "actions" TEXT, PRIMARY KEY ("id"));`
        ]});
        //
        migrations.push({version: 28, queries: [
            `INSERT INTO "quest"(id, quest_group_id, title, description) VALUES (1, 1, 'Добыть дубовые брёвна', 'Необходимо добыть бревна дуба. После этого вы сможете скрафтить орудия, для дальнейшего развития.\r\n` +
            `\r\n` +
            `1-й шаг — Найдите дерево\r\n` +
            `Найдите любое дерево, подойдите к нему так близко, чтобы вокруг блока древесины, на которую вы нацелены появилась тонкая обводка. Зажмите левую кнопку мыши и не отпускайте, пока не будет добыто бревно.\r\n` +
            `Чтобы сломать бревно рукой нужно примерно 6 секунд.\r\n` +
            `\r\n` +
            `2-й шаг — Подберите блок\r\n` +
            `Подойдите ближе к выпавшему блоку, он попадёт в ваш инвентарь.');`,

            `INSERT INTO "quest"(id, quest_group_id, title, description) VALUES (2, 2, 'Выкопать землю', 'Это земляные работы. Почувствуй себя землекопом.\r\n` +
            `Земля (она же дёрн) может быть добыта чем угодно.');`,

            `INSERT INTO "quest"(id, quest_group_id, title, description) VALUES (3, 1, 'Скрафтить и установить верстак', 'Необходимо скрафтить и установить верстак. Без него вы не сможете дальше развиваться.\r\n` +
            `\r\n` +
            `1-й шаг\r\n` +
            `Поместите 4 единицы досок в 4 слота инвентаря и заберите в правой части верстак.\r\n` +
            `\r\n` +
            `2-й шаг\r\n` +
            `Поместите верстак в один из нижних слотов инвентаря\r\n` +
            `\r\n` +
            `3-й шаг\r\n` +
            `Выйдите из инвентаря нажав клавишу «E». Выберите слот, в котором находится предмет крутя колесико мыши или клавишами 1-9. Установите верстак на землю правой кнопкой мыши.\r\n` +
            `\r\n` +
            `Теперь вы можете создавать сложные предметы в верстаке. Простые предметы, такие как доски и палки также можно создавать в верстаке. Вы можете забрать верстак с собой, сломав его руками, топор сделает это гораздо быстрее. Пример создания деревянной кирки из досок и палок.');`,
            // actions
            `INSERT INTO "quest_action" VALUES (1, 1, 1, 3, 5, NULL, 'Добыть 5 дубовых брёвен');`,
            `INSERT INTO "quest_action" VALUES (2, 2, 1, 2, 20, NULL, 'Выкопать 20 земляных блоков');`,
            `INSERT INTO "quest_action" VALUES (3, 3, 2, 58, 1, NULL, 'Скрафтить верстак');`,
            `INSERT INTO "quest_action" VALUES (4, 3, 3, 58, 1, NULL, 'Установить верстак в удобном для вас месте');`,
            // groups
            `INSERT INTO "quest_group" VALUES (1, 'Основные задания');`,
            `INSERT INTO "quest_group" VALUES (2, 'Дополнительные задания');`,
            // rewards
            `INSERT INTO "quest_reward" VALUES (1, 1, 3, 8);`,
            `INSERT INTO "quest_reward" VALUES (2, 2, 2, 20);`,
            `INSERT INTO "quest_reward" VALUES (3, 3, 130, 4);`,
            `INSERT INTO "quest_reward" VALUES (4, 3, 59, 4);`
        ]});
        migrations.push({version: 29, queries: [`alter table user_quest add column "is_completed" integer NOT NULL DEFAULT 0`]});
        migrations.push({version: 30, queries: [
            `alter table quest add column "is_default" integer NOT NULL DEFAULT 0`,
            `update quest set is_default = 1 where id in(1, 2, 3)`
        ]});
        migrations.push({version: 31, queries: [`alter table user_quest add column "in_progress" integer NOT NULL DEFAULT 0`]});
        migrations.push({version: 32, queries: [`delete from user_quest`]});
        migrations.push({version: 33, queries: [
            `UPDATE quest SET is_default = 0 WHERE id = 3`,
            `ALTER TABLE quest ADD COLUMN "next_quests" TEXT`,
            `UPDATE quest SET next_quests = '[3]' WHERE id = 1`
        ]});
        migrations.push({version: 34, queries: [
            `DELETE FROM user_quest;`,
            `UPDATE quest SET is_default = 0, next_quests = '[2]' WHERE id = 3;`,
            `UPDATE quest SET is_default = 0 WHERE id = 2;`,
            // Update quest 1
            `UPDATE quest SET description = 'Необходимо добыть бревна дуба. После этого вы сможете скрафтить орудия, для дальнейшего развития.\r\n` +
            `\r\n` +
            `1-й шаг — Найдите дерево\r\n` +
            `Найдите любое дерево, подойдите к нему так близко, чтобы вокруг блока древесины, на которую вы нацелены появилась тонкая обводка. Зажмите левую кнопку мыши и не отпускайте, пока не будет добыто бревно.\r\n` +
            `Чтобы сломать бревно рукой нужно примерно 6 секунд.\r\n` +
            `\r\n` +
            `2-й шаг — Подберите блок\r\n` +
            `Подойдите ближе к выпавшему блоку, он попадёт в ваш инвентарь.' WHERE id = 1;`,
            // Update quest 2
            `UPDATE quest SET description = 'Это земляные работы. Почувствуй себя землекопом.\r\n` +
            `Земля (она же дёрн) может быть добыта чем угодно.' WHERE id = 2;`,
            // Update quest 3
            `UPDATE quest SET description = 'Необходимо скрафтить и установить верстак. Без него вы не сможете дальше развиваться.\r\n` +
            `\r\n` +
            `1-й шаг\r\n` +
            `Поместите 4 единицы досок в 4 слота инвентаря и заберите в правой части верстак.\r\n` +
            `\r\n` +
            `2-й шаг\r\n` +
            `Поместите верстак в один из нижних слотов инвентаря\r\n` +
            `\r\n` +
            `3-й шаг\r\n` +
            `Выйдите из инвентаря нажав клавишу «E». Выберите слот, в котором находится предмет крутя колесико мыши или клавишами 1-9. Установите верстак на землю правой кнопкой мыши.\r\n` +
            `\r\n` +
            `Теперь вы можете создавать сложные предметы в верстаке. Простые предметы, такие как доски и палки также можно создавать в верстаке. Вы можете забрать верстак с собой, сломав его руками, топор сделает это гораздо быстрее.' WHERE id = 3;`,
        ]});
        migrations.push({version: 35, queries: [
            `CREATE TABLE "chunk" ("id" INTEGER NOT NULL, "dt" integer, "addr" TEXT, "mobs_is_generated" integer NOT NULL DEFAULT 0, PRIMARY KEY ("id"));`,
        ]});
        migrations.push({version: 36, queries: [
            `DELETE FROM entity;`,
            `DELETE FROM chunk;`,
        ]});
        migrations.push({version: 37, queries: [
            `update quest_action set block_id = 18 where block_id = 2;`,
            `update user_quest set actions = replace(actions, '"block_id":2,', '"block_id":18,');`,
        ]});
        migrations.push({version: 38, queries: [
            `DELETE FROM entity;`,
            `DELETE FROM chunk;`,
        ]});

        migrations.push({version: 39, queries: [
            `CREATE TABLE "teleport_points" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "user_id" integer NOT NULL,
            "x" real NOT NULL,
            "y" real NOT NULL,
            "z" real NOT NULL,
            "title" VARCHER(50)
            );`
        ]});

        migrations.push({version: 40, queries: [
            `alter table world_modify add column "block_id" integer DEFAULT NULL`,
            `UPDATE world_modify SET block_id = json_extract(params, '$.id') WHERE params IS NOT NULL`
        ]});

        migrations.push({version: 41, queries: [
            `UPDATE world_modify AS m
            SET extra_data = COALESCE((SELECT '{"can_destroy":' || (case when c.slots is null then 'true' when c.slots = '{}' then 'true' else 'false' end) || ',"slots":' || coalesce(c.slots, '{}') || '}' from chest c where m.entity_id = c.entity_id), '{"can_destroy":true,"slots":{}}')
            WHERE m.block_id = 54 AND m.extra_data IS NULL`
        ]});

        migrations.push({version: 42, queries: [
            `update world_modify set extra_data = '{"can_destroy":true,"slots":{}}' where block_id = 61 and extra_data is null`
        ]});

        migrations.push({version: 43, queries: []});

        migrations.push({version: 44, queries: []});

        migrations.push({version: 45, queries: [
            `UPDATE world_modify SET block_id = 98, params = '{"id": 98}' WHERE block_id IN(43, 125);`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":43,', '"id":98,');`,
            `UPDATE user SET inventory = REPLACE(inventory, ',"id":43}', ',"id":98}');`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":125,', '"id":98,');`,
            `UPDATE user SET inventory = REPLACE(inventory, ',"id":125}', ',"id":98}');`,
            `UPDATE world_modify SET extra_data = '{"active":true}' WHERE block_id = 660;`,
        ]});

        migrations.push({version: 46, queries: [
            `UPDATE world_modify SET block_id = 1315, params = '{"id": 1315}' WHERE block_id = 450;`,
            `UPDATE world_modify SET block_id = 1311, params = '{"id": 1311}' WHERE block_id = 451;`,
            `UPDATE world_modify SET block_id = 1312, params = '{"id": 1312}' WHERE block_id = 452;`,
            `UPDATE world_modify SET block_id = 1309, params = '{"id": 1309}' WHERE block_id = 453;`,
            `UPDATE world_modify SET block_id = 1307, params = '{"id": 1307}' WHERE block_id = 454;`,
            `UPDATE world_modify SET block_id = 1313, params = '{"id": 1313}' WHERE block_id = 455;`,
            `UPDATE world_modify SET block_id = 1314, params = '{"id": 1314}' WHERE block_id = 503;`,
            `UPDATE world_modify SET block_id = 1304, params = '{"id": 1304}' WHERE block_id = 507;`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":450,', '"id":1315,');`,
            `UPDATE user SET inventory = REPLACE(inventory, ',"id":450}', ',"id":1315}');`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":451,', '"id":1311,');`,
            `UPDATE user SET inventory = REPLACE(inventory, ',"id":451}', ',"id":1311}');`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":452,', '"id":1312,');`,
            `UPDATE user SET inventory = REPLACE(inventory, ',"id":452}', ',"id":1312}');`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":453,', '"id":1309,');`,
            `UPDATE user SET inventory = REPLACE(inventory, ',"id":453}', ',"id":1309}');`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":454,', '"id":1307,');`,
            `UPDATE user SET inventory = REPLACE(inventory, ',"id":454}', ',"id":1307}');`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":455,', '"id":1313,');`,
            `UPDATE user SET inventory = REPLACE(inventory, ',"id":455}', ',"id":1313}');`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":503,', '"id":1314,');`,
            `UPDATE user SET inventory = REPLACE(inventory, ',"id":503}', ',"id":1314}');`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":507,', '"id":1304,');`,
            `UPDATE user SET inventory = REPLACE(inventory, ',"id":507}', ',"id":1304}');`,
        ]});

        migrations.push({version: 47, queries: [
            `UPDATE user SET inventory = REPLACE(inventory, '}"', ',"');`,
        ]});

        migrations.push({version: 48, queries: [
            `ALTER TABLE entity ADD COLUMN "is_active" integer NOT NULL DEFAULT 1`,
            `ALTER TABLE "user" ADD COLUMN stats TEXT;`
        ]});

        migrations.push({version: 49, queries: [
            {
                sql: 'UPDATE "user" SET stats = :stats WHERE stats IS NULL OR stats == :null',
                placeholders: {
                    ':stats':  JSON.stringify(this.getDefaultPlayerStats()),
                    ':null':  'null'
                }
            }
        ]});

        migrations.push({version: 50, queries: [
            `UPDATE entity SET is_active = 0 WHERE indicators LIKE '%"live","value":0}%'`,
        ]});

        migrations.push({version: 51, queries: [
            `UPDATE "quest" SET "title" = '{"ru":"Добыть дубовые брёвна","en":"Get oak logs"}', "description" = '{"ru":"Необходимо добыть бревна дуба. После этого вы сможете скрафтить орудия, для дальнейшего развития.\\r\\n\\r\\n1-й шаг — Найдите дерево\\r\\nНайдите любое дерево, подойдите к нему так близко, чтобы вокруг блока древесины, на которую вы нацелены появилась тонкая обводка. Зажмите левую кнопку мыши и не отпускайте, пока не будет добыто бревно.\\r\\nЧтобы сломать бревно рукой нужно примерно 6 секунд.\\r\\n\\r\\n2-й шаг — Подберите блок\\r\\nПодойдите ближе к выпавшему блоку, он попадёт в ваш инвентарь.","en":"You need to get oak logs. After that, you can craft weapons for further development.\\r\\n\\r\\n1st step - Find a tree\\r\\nFind any tree, get close enough to it so that a thin outline appears around the block of wood you are aiming at. Hold down the left mouse button and do not release until the log is mined.\\r\\nIt takes about 6 seconds to break a log by hand.\\r\\n\\r\\n2nd step - Pick up a block\\r\\nGet closer to the dropped block, it will go into your inventory."}' WHERE "id" = 1;`,
            `UPDATE "quest" SET "title" = '{"ru":"Выкопать землю","en":"Dig up the dirt"}', "description" = '{"ru":"Это земляные работы. Почувствуй себя землекопом.\\r\\nЗемля (она же дёрн) может быть добыта чем угодно.","en":"This is earthworks. Feel like a digger.\\r\\nDirt can be mined by anything."}' WHERE "id" = 2;`,
            `UPDATE "quest" SET "title" = '{"ru":"Скрафтить и установить Верстак","en":"Craft and install a Crafting Table"}', "description" = '{"ru":"Необходимо скрафтить и установить верстак. Без него вы не сможете дальше развиваться.\\r\\n\\r\\n1-й шаг\\r\\nПоместите 4 единицы досок в 4 слота инвентаря и заберите в правой части верстак.\\r\\n\\r\\n2-й шаг\\r\\nПоместите верстак в один из нижних слотов инвентаря\\r\\n\\r\\n3-й шаг\\r\\nВыйдите из инвентаря нажав клавишу «E». Выберите слот, в котором находится предмет крутя колесико мыши или клавишами 1-9. Установите верстак на землю правой кнопкой мыши.\\r\\n\\r\\nТеперь вы можете создавать сложные предметы в верстаке. Простые предметы, такие как доски и палки также можно создавать в верстаке. Вы можете забрать верстак с собой, сломав его руками, топор сделает это гораздо быстрее.","en":"You need to craft and install a Crafting Table. Without it, you will not be able to develop further.\\r\\n\\r\\n1st step\\r\\nPlace 4 planks in the 4 inventory slots and take the Crafting Table on the right side.\\r\\n\\r\\n2nd step\\r\\nPlace the Crafting Table in one of the lower inventory slots\\r\\n\\r\\n3rd step\\r\\nExit the inventory by pressing the \\"E\\" key. Select the slot the item is in by scrolling the mouse wheel or using the 1-9 keys. Place the Crafting Table on the ground with the right mouse button.\\r\\n\\r\\nYou can now craft complex items at the Crafting Table. Simple items like planks and sticks can also be crafted at the Crafting Table. You can take the Crafting Table with you by breaking it with your hands, the ax will do it much faster."}' WHERE "id" = 3;`,
            `UPDATE "quest_action" SET "description" = '{"ru":"Добыть 5 дубовых брёвен","en":"Mine 5 oak logs"}' WHERE "id" = 1;`,
            `UPDATE "quest_action" SET "description" = '{"ru":"Выкопать 20 земляных блоков","en":"Dig 20 dirt blocks"}' WHERE "id" = 2;`,
            `UPDATE "quest_action" SET "description" = '{"ru":"Скрафтить верстак","en":"Craft a Crafting Table"}' WHERE "id" = 3;`,
            `UPDATE "quest_action" SET "description" = '{"ru":"Установить верстак в удобном для вас месте","en":"Install the Crafting Table in a convenient place for you"}' WHERE "id" = 4;`,
            `UPDATE "quest_action_type" SET "title" = '{"ru":"Добыть","en":"Mine"}' WHERE "id" = 1;`,
            `UPDATE "quest_action_type" SET "title" = '{"ru":"Скрафтить","en":"Craft"}' WHERE "id" = 2;`,
            `UPDATE "quest_action_type" SET "title" = '{"ru":"Установить блок","en":"Set block"}' WHERE "id" = 3;`,
            `UPDATE "quest_action_type" SET "title" = '{"ru":"Использовать инструмент","en":"Use tool"}' WHERE "id" = 4;`,
            `UPDATE "quest_action_type" SET "title" = '{"ru":"Достигнуть координат","en":"Reach the coordinates"}' WHERE "id" = 5;`,
            `UPDATE "quest_group" SET "title" = '{"ru":"Основные задания","en":"Main tasks"}' WHERE "id" = 1;`,
            `UPDATE "quest_group" SET "title" = '{"ru":"Дополнительные задания","en":"Additional tasks"}' WHERE "id" = 2;`,

            `DELETE FROM user_quest`,

            /*
            `UPDATE quest_group SET title = json_object('ru', title, 'en', title) WHERE title NOT LIKE '%{"%';`,
            `UPDATE quest SET title = json_object('ru', title, 'en', title) WHERE title NOT LIKE '%{"%';`,
            `UPDATE quest SET description = json_object('ru', description, 'en', description) WHERE description NOT LIKE '%{"%';`,
            `UPDATE quest_action_type SET title = json_object('ru', title, 'en', title) WHERE title NOT LIKE '%{"%';`,
            `UPDATE quest_action SET description = json_object('ru', description, 'en', description) WHERE description NOT LIKE '%{"%';`,
            */
        ]});

        migrations.push({version: 52, queries: [
            `DELETE from world_modify WHERE json_extract(params, '$.rotate.x') > 3 AND block_id = 50`,
        ]});

        migrations.push({version: 53, queries: [
            'ALTER TABLE entity ADD COLUMN extra_data text'
        ]});

        migrations.push({version: 54, queries: [
            'DELETE FROM world_modify WHERE block_id = 105'
        ]});

        migrations.push({version: 55, queries: [
            `DELETE FROM entity WHERE type = 'bee'`,
            `ALTER TABLE entity ADD COLUMN "is_dead" integer NOT NULL DEFAULT 0`,
            `UPDATE entity SET is_dead = 1 - is_active`,
            `DELETE FROM world_modify WHERE block_id = 1447`
        ]});

        migrations.push({version: 56, queries: [
            `UPDATE entity SET extra_data = '{"is_alive":true,"play_death_animation":true}' WHERE extra_data IS NULL`,
        ]});

        migrations.push({version: 57, queries: [
            `DROP INDEX "main"."world_modify_xyz";`,

            `ALTER TABLE "main"."world_modify" RENAME TO "_world_modify_old_20220614";`,

            `CREATE TABLE "main"."world_modify" (
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
              "ticks" INTEGER DEFAULT NULL,
              "block_id" integer DEFAULT NULL,
              PRIMARY KEY ("id")
            );`,

            `INSERT INTO "main"."world_modify" ("id", "world_id", "dt", "user_id", "params", "user_session_id", "x", "y", "z", "entity_id", "extra_data", "ticks", "block_id") SELECT "id", "world_id", "dt", "user_id", "params", "user_session_id", "x", "y", "z", "entity_id", "extra_data", "ticks", "block_id" FROM "main"."_world_modify_old_20220614";`,

            `CREATE INDEX "main"."world_modify_xyz"
            ON "world_modify" (
              "x" ASC,
              "y" ASC,
              "z" ASC
            );`,

            `DROP TABLE _world_modify_old_20220614`,
        ]});

        migrations.push({version: 58, queries: [
            `UPDATE world_modify SET extra_data = '{}' WHERE block_id in (616, 650)`
        ]});

        migrations.push({version: 59, queries: [
            `DELETE FROM world_modify WHERE block_id IN(29, 33, 136, 161, 174, 212)`
        ]});

        migrations.push({version: 60, queries: [
            `DELETE FROM world_modify WHERE block_id IN(104)`
        ]});

        migrations.push({version: 61, queries: [
            `UPDATE world_modify SET block_id = 1509 WHERE block_id = 504;`,
            `UPDATE world_modify SET block_id = 1504 WHERE block_id = 505;`
        ]});

        migrations.push({version: 62, queries: [
            `UPDATE world_modify SET extra_data = REPLACE(extra_data,'"id":504,','"id":1509,');`,
            `UPDATE world_modify SET extra_data = REPLACE(extra_data,'"id":505,','"id":1504,');`,
            `UPDATE world_modify SET params = REPLACE(params,'"id":504','"id":1509');`,
            `UPDATE world_modify SET params = REPLACE(params,'"id":505','"id":1504');`
        ]});

        migrations.push({version: 63, queries: [
            `DROP INDEX "main"."world_modify_xyz";`,

            `ALTER TABLE "main"."world_modify" RENAME TO "_world_modify_old_20220703_2";`,

            `CREATE TABLE "main"."world_modify" (
              "id" INTEGER,
              "world_id" INTEGER NOT NULL,
              "dt" integer,
              "user_id" INTEGER,
              "params" TEXT,
              "user_session_id" integer,
              "x" integer NOT NULL,
              "y" integer NOT NULL,
              "z" integer NOT NULL,
              "entity_id" text,
              "extra_data" text,
              "ticks" INTEGER DEFAULT NULL,
              "block_id" integer DEFAULT NULL,
              PRIMARY KEY ("id")
            );`,

            `INSERT INTO "main"."world_modify" ("id", "world_id", "dt", "user_id", "params", "user_session_id", "x", "y", "z", "entity_id", "extra_data", "ticks", "block_id") SELECT "id", "world_id", "dt", "user_id", "params", "user_session_id", "x", "y", "z", "entity_id", "extra_data", "ticks", "block_id" FROM "main"."_world_modify_old_20220703_2";`,

            `CREATE INDEX "main"."world_modify_xyz"
            ON "world_modify" (
              "x" ASC,
              "y" ASC,
              "z" ASC
            );`,

            `ALTER TABLE world_modify ADD COLUMN "chunk_x" integer NOT NULL DEFAULT 0`,
            `ALTER TABLE world_modify ADD COLUMN "chunk_y" integer NOT NULL DEFAULT 0`,
            `ALTER TABLE world_modify ADD COLUMN "chunk_z" integer NOT NULL DEFAULT 0`,

            `UPDATE world_modify
            SET chunk_x = floor(cast(x as real) / ${OLD_CHUNK_SIZE.x}.),
            chunk_y = floor(cast(y as real) / ${OLD_CHUNK_SIZE.y}.),
            chunk_z = floor(cast(z as real) / ${OLD_CHUNK_SIZE.z}.)`,

            `CREATE INDEX "main"."world_modify_chunk_xyz"
            ON "world_modify" (
              "chunk_x" ASC,
              "chunk_y" ASC,
              "chunk_z" ASC
            );`,

            `DROP TABLE _world_modify_old_20220703_2`,

        ]});

        migrations.push({version: 64, queries: [
            `UPDATE world_modify SET block_id = 514, params = '{"id":514}', extra_data = '{"is_head": true}' WHERE block_id = 515;`,
            `UPDATE world_modify SET block_id = 516, params = '{"id":516}', extra_data = '{"is_head": true}' WHERE block_id = 517;`,
            `UPDATE world_modify SET block_id = 572, params = '{"id":572}', extra_data = '{"is_head": true}' WHERE block_id = 573;`,
            `UPDATE world_modify SET block_id = 993, params = '{"id":993}', extra_data = '{"is_head": true}' WHERE block_id = 994;`,
            `UPDATE world_modify SET block_id = 574, params = replace(params, '"id":575', '"id":574'), extra_data = replace(extra_data, '"point":', '"is_head": true, "point":') WHERE block_id = 575;`,
            `UPDATE world_modify SET block_id = 576, params = replace(params, '"id":577', '"id":576'), extra_data = replace(extra_data, '"point":', '"is_head": true, "point":') WHERE block_id = 577;`,
            `UPDATE world_modify SET block_id = 578, params = replace(params, '"id":579', '"id":578'), extra_data = replace(extra_data, '"point":', '"is_head": true, "point":') WHERE block_id = 579;`,
            `UPDATE world_modify SET block_id = 580, params = replace(params, '"id":581', '"id":580'), extra_data = replace(extra_data, '"point":', '"is_head": true, "point":') WHERE block_id = 581;`,
            `UPDATE world_modify SET block_id = 582, params = replace(params, '"id":583', '"id":582'), extra_data = replace(extra_data, '"point":', '"is_head": true, "point":') WHERE block_id = 583;`,
            `UPDATE world_modify SET block_id = 584, params = replace(params, '"id":585', '"id":584'), extra_data = replace(extra_data, '"point":', '"is_head": true, "point":') WHERE block_id = 585;`,
            `UPDATE world_modify SET block_id = 586, params = replace(params, '"id":587', '"id":586'), extra_data = replace(extra_data, '"point":', '"is_head": true, "point":') WHERE block_id = 587;`,
            `UPDATE world_modify SET block_id = 588, params = replace(params, '"id":589', '"id":588'), extra_data = replace(extra_data, '"point":', '"is_head": true, "point":') WHERE block_id = 589;`,
            `UPDATE world_modify SET block_id = 590, params = replace(params, '"id":591', '"id":590'), extra_data = replace(extra_data, '"point":', '"is_head": true, "point":') WHERE block_id = 591;`
        ]});

        migrations.push({version: 65, queries: [
            `UPDATE world_modify SET params = json_set(params, '$.rotate.x', json_extract(params, '$.rotate.x') + 2 % 4) WHERE block_id BETWEEN 1200 and 1215 AND json_extract(extra_data, '$.is_head')`
        ]});

        migrations.push({version: 66, queries: [
            `DELETE FROM world_modify WHERE block_id = 112;`,
        ]});

        // @important This need if change chunk size
        migrations.push({version: 67, queries: [
            `ALTER TABLE world_modify ADD COLUMN "index" INTEGER`,
            `UPDATE world_modify SET "index" = (${OLD_CHUNK_SIZE.x} * ${OLD_CHUNK_SIZE.z}) * ((y - chunk_y * ${OLD_CHUNK_SIZE.y}) % ${OLD_CHUNK_SIZE.y}) +
            (((z - chunk_z * ${OLD_CHUNK_SIZE.z}) % ${OLD_CHUNK_SIZE.z}) * ${OLD_CHUNK_SIZE.x}) +
            ((x - chunk_x * ${OLD_CHUNK_SIZE.x}) % ${OLD_CHUNK_SIZE.x})`
        ]});

        migrations.push({version: 68, queries: [
            `DROP INDEX IF EXISTS "main"."world_modify_id";`,
            `DROP INDEX IF EXISTS "main"."world_modify_index";`
        ]});

        //
        migrations.push({version: 69, queries: [
            `CREATE TABLE IF NOT EXISTS "main"."world_modify_chunks" (
                "x" integer NOT NULL DEFAULT 0,
                "y" integer NOT NULL DEFAULT 0,
                "z" integer NOT NULL DEFAULT 0,
                "data" TEXT,
            PRIMARY KEY ("x", "y", "z") ON CONFLICT REPLACE);`,

            update_world_modify_chunks,

            `CREATE INDEX IF NOT EXISTS "main"."world_modify_chunks_xyz"
                ON "world_modify_chunks" (
                "x" ASC,
                "y" ASC,
                "z" ASC
            );`,

            `DROP TABLE IF EXISTS _world_modify_old_20220614;`,
            `DROP TABLE IF EXISTS _world_modify_old_20220703_2;`,

        ]});

        migrations.push({version: 70, queries: [
            `ALTER TABLE world ADD COLUMN "rules" TEXT NOT NULL DEFAULT '{}'`,
        ]});

        migrations.push({version: 71, queries: [
            `UPDATE world_modify SET extra_data = NULL WHERE extra_data = '{}';`,
            `UPDATE world_modify SET extra_data = NULL WHERE block_id = 18 AND extra_data IS NOT NULL AND json_extract(extra_data, '$.max_ticks') IS NULL`,
            update_world_modify_chunks,
        ]});

        migrations.push({version: 72, queries: [
            `DELETE FROM world_modify WHERE block_id = 34`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":34,', '"id":911,');`,
            update_world_modify_chunks,
        ]});

        migrations.push({version: 73, queries: [
            `DELETE FROM world_modify WHERE block_id = 142`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":142,', '"id":196,');`,
            update_world_modify_chunks,
        ]});

        migrations.push({version: 74, queries: [
            `UPDATE world_modify SET block_id = 593, extra_data = '{"stage": 1}' WHERE block_id = 594;`,
            `UPDATE world_modify SET block_id = 593, extra_data = '{"stage": 2}' WHERE block_id = 595;`,
            update_world_modify_chunks,
        ]});

        migrations.push({version: 75, queries: [
            `DELETE FROM world_modify WHERE block_id = 142`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":142,', '"id":196,');`,
            update_world_modify_chunks,
        ]});

        migrations.push({version: 76, queries: [
            `DELETE FROM world_modify WHERE block_id = 593`,
            update_world_modify_chunks,
        ]});

        migrations.push({version: 77, queries: [
            `DELETE FROM world_modify WHERE block_id = 94`,
            `CREATE TABLE "portal" (
                "user_id" INTEGER,
                "dt" integer,
                "x" integer,
                "y" integer,
                "z" integer,
                "rotate" TEXT,
                "size" REAL,
                "player_pos" TEXT,
                "portal_block_id" INTEGER
            );`,
            `CREATE INDEX "portal_xyz" ON "portal" ("x", "y", "z");`,
            update_world_modify_chunks,
        ]});

        migrations.push({version: 78, queries: [
            `DELETE FROM world_modify WHERE block_id = 94`,
            `DELETE FROM portal`,
            `ALTER TABLE portal ADD COLUMN "type" TEXT NOT NULL`,
            `ALTER TABLE portal ADD COLUMN "pair" TEXT`,
            update_world_modify_chunks,
        ]});

        migrations.push({version: 79, queries: [
            `DELETE FROM world WHERE json_extract(generator, '$.id') IS NULL`,
        ]});

        migrations.push({version: 80, queries: [
            `ALTER TABLE world_modify_chunks ADD COLUMN "data_blob" BLOB`,
        ]});

        migrations.push({version: 81, queries: [
            `CREATE TABLE "world_chunks_fluid" (
                "x" integer NOT NULL,
                "y" integer NOT NULL,
                "z" integer NOT NULL,
                "data" blob,
                PRIMARY KEY ("x", "y", "z") ON CONFLICT REPLACE
              );`,
            `DELETE from world_modify WHERE block_id = 200 OR block_id = 202 OR block_id = 170 OR block_id = 171;`,
            `UPDATE world_modify_chunks SET data_blob = NULL WHERE data LIKE '"id":200,' OR data LIKE '"id":200}'
                 OR data LIKE '"id":202,' OR data LIKE '"id":202}'
                 OR data LIKE '"id":170,' OR data LIKE '"id":170}'
                 OR data LIKE '"id":171,' OR data LIKE '"id":171}';`,
        ]});

        migrations.push({version: 82, queries: [
            `DELETE from world_modify WHERE block_id = 95;`,
            `UPDATE world_modify_chunks SET data_blob = NULL WHERE data LIKE '"id":95,' OR data LIKE '"id":95}';`,
        ]});
        migrations.push({version: 83, queries: [
            `update world set game_mode = 'creative' where guid = '0c8970d7-942b-4208-9743-dbec371558fa'`,
        ]});
        migrations.push({version: 84, queries: [
            `UPDATE world_modify SET block_id = 260 WHERE block_id = 347;`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":347,', '"id":260,');`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":348,', '"id":320,');`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":349,', '"id":300,');`,
            `UPDATE world_modify SET block_id = 320 WHERE block_id = 348;`,
            `UPDATE world_modify SET block_id = 300 WHERE block_id = 349;`,
            `DELETE FROM world_modify_chunks`,
            update_world_modify_chunks,
        ]});
        migrations.push({version: 85, queries: [
            `UPDATE world_modify SET block_id = 61 WHERE block_id = 62;`,
            `UPDATE user SET inventory = REPLACE(inventory, '"id":61,', '"id":62,');`,
            `DELETE FROM world_modify_chunks`,
            update_world_modify_chunks,
        ]});
        migrations.push({version: 86, queries: [
            `alter table user add column "ender_chest" TEXT DEFAULT '{"slots":{}}'`,
        ]});
        migrations.push({version: 87, queries: [
            `CREATE TABLE "chunk_delayed_calls" (
                "x" integer NOT NULL,
                "y" integer NOT NULL,
                "z" integer NOT NULL,
                "delayed_calls" TEXT NOT NULL,
            PRIMARY KEY ("x", "y", "z") ON CONFLICT REPLACE);`,
        ]});
        migrations.push({version: 88, queries: [
            // reorder indices (x, y, z) -> (x, z, y)
            'DROP INDEX portal_xyz',
            'CREATE INDEX portal_xyz ON portal (x, z, y)',
            'DROP INDEX world_modify_chunk_xyz',
            'CREATE INDEX world_modify_chunk_xyz ON world_modify (chunk_x, chunk_z, chunk_y)',
            'DROP INDEX world_modify_xyz',
            'CREATE INDEX world_modify_xyz ON world_modify (x, z, y)',
            // reorder index (x, y, z) -> (x, z, y) in world_modify_chunks
            // note: _rowid_ is used in the code
            `CREATE TABLE "world_modify_chunks_copy" (
                "x"	integer NOT NULL DEFAULT 0,
                "y"	integer NOT NULL DEFAULT 0,
                "z"	integer NOT NULL DEFAULT 0,
                "data" TEXT,
                "data_blob"	BLOB,
                "has_data_blob" INTEGER DEFAULT 0,
                PRIMARY KEY("x","z","y") ON CONFLICT REPLACE)`,
            `INSERT INTO world_modify_chunks_copy (x, y, z, data, data_blob)
               SELECT x, y, z, data, data_blob FROM world_modify_chunks`,
            'DROP TABLE world_modify_chunks',
            'ALTER TABLE world_modify_chunks_copy RENAME TO world_modify_chunks',
            // change chunk primary key; merge chunk with chunk_delayed_calls
            'DROP TABLE chunk_delayed_calls',
            `CREATE TABLE "chunk_copy" (
                "addr"	TEXT,
                "dt"	integer,
                "mobs_is_generated"	integer NOT NULL DEFAULT 0,
                "delayed_calls" TEXT,
                PRIMARY KEY("addr")
            ) WITHOUT ROWID`,
            `INSERT INTO chunk_copy (addr, dt, mobs_is_generated)
                SELECT addr, dt, mobs_is_generated FROM chunk`,
            'DROP TABLE chunk',
            'ALTER TABLE chunk_copy RENAME TO chunk',
            // add new indices
            'CREATE INDEX world_guid ON world (guid)',
            'CREATE INDEX user_guid ON user (guid)',
            'CREATE INDEX user_is_admin ON user (is_admin)',
            'CREATE INDEX quest_action_quest_id ON quest_action (quest_id)',
            'CREATE INDEX quest_reward_quest_id ON quest_reward (quest_id)',
            'CREATE INDEX user_quest_user_id_quest_id ON user_quest (user_id, quest_id)',
            'CREATE INDEX teleport_points_user_id ON teleport_points (user_id)',
            'CREATE INDEX drop_item_entity_id ON drop_item (entity_id)',
            'CREATE INDEX drop_item_dt ON drop_item (dt)',
            'CREATE INDEX entity_xyz ON entity (x, z, y)',
            'CREATE INDEX entity_entity_id ON entity (entity_id)',
            'CREATE INDEX world_modify_chunks_has_data_blob ON world_modify_chunks (has_data_blob)',
            'CREATE INDEX world_chunks_fluid_xyz ON world_chunks_fluid (x, z, y)',
            // allow deletion in tables
            'DELETE FROM entity WHERE is_dead = 1',
            'ALTER TABLE entity DROP COLUMN is_dead',
            'DELETE FROM drop_item WHERE is_deleted = 1',
            'ALTER TABLE drop_item DROP COLUMN is_deleted',
        ]});

        migrations.push({version: 89, queries: [
            `ALTER TABLE world ADD COLUMN "ore_seed" CHAR(36) default NULL`,
            `UPDATE world SET ore_seed = (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))) WHERE ore_seed IS NULL`
        ]});

        migrations.push({version: 90, queries: [
            'ALTER TABLE world_modify_chunks ADD COLUMN "private_data_blob" BLOB default NULL'
        ]});

        migrations.push({version: 91, queries: [
            `UPDATE world_modify SET block_id = 9 WHERE block_id IN (114, 155, 520)`,
            `UPDATE world_modify SET
                params = REPLACE(REPLACE(REPLACE(params, '"id":114,', '"id":9,'), '"id":155,', '"id":9,'), '"id":520,', '"id":9,'),
                extra_data = REPLACE(REPLACE(REPLACE(extra_data, '"id":114,', '"id":9,'), '"id":155,', '"id":9,'), '"id":520,', '"id":9,')
                WHERE extra_data IS NOT NULL`,
            `UPDATE user SET inventory = REPLACE(REPLACE(REPLACE(inventory, '"id":114,', '"id":9,'), '"id":155,', '"id":9,'), '"id":520,', '"id":9,');`,
            update_world_modify_chunks,
        ]});

        migrations.push({version: 92, queries: [
            // Uint32Array of _rowid_ of world_modify_chunks that must be rebuilt from world_modify.
            // If it's null, all chunks must be rebuilt.
            'ALTER TABLE world ADD COLUMN recovery BLOB DEFAULT NULL',
            //
            'DROP INDEX world_modify_xyz', // this index became unsued
            'DROP INDEX world_modify_chunk_xyz', // add "index" field to this one
            'CREATE INDEX world_modify_chunk_xyz_index ON world_modify (chunk_x, chunk_z, chunk_y, "index")',
            // there was int32 overflow in delayed_calls times
            'UPDATE chunk SET delayed_calls = NULL'
        ]});

        migrations.push({version: 93, queries: [
            // TODO after some time, remove other colums that are included in the state
            'ALTER TABLE user ADD COLUMN state TEXT DEFAULT NULL'
        ]});

        migrations.push({version: 94, queries: [

            `DROP INDEX "main"."user_guid";`,

            `DROP INDEX "main"."user_is_admin";`,
            
            `ALTER TABLE "main"."user" RENAME TO "_user_old_20230312";`,
            
            `CREATE TABLE "main"."user" (
              "id" INTEGER PRIMARY KEY AUTOINCREMENT,
              "guid" text NOT NULL,
              "username" TEXT,
              "inventory" TEXT,
              "indicators" TEXT,
              "dt" integer,
              "pos_spawn" TEXT,
              "pos" TEXT,
              "rotate" TEXT,
              "dt_moved" integer,
              "is_admin" integer DEFAULT 0,
              "chunk_render_dist" integer DEFAULT ${DEFAULT_RENDER_DISTANCE},
              "game_mode" TEXT DEFAULT NULL,
              "stats" TEXT,
              "ender_chest" TEXT DEFAULT '{"slots":{}}',
              "state" TEXT DEFAULT NULL
            );`,
            
            `INSERT INTO "main"."sqlite_sequence" (name, seq) VALUES ('user', '2355');`,
            
            `INSERT INTO "main"."user" ("id", "guid", "username", "inventory", "indicators", "dt", "pos_spawn", "pos", "rotate", "dt_moved", "is_admin", "chunk_render_dist", "game_mode", "stats", "ender_chest", "state") SELECT "id", "guid", "username", "inventory", "indicators", "dt", "pos_spawn", "pos", "rotate", "dt_moved", "is_admin", "chunk_render_dist", "game_mode", "stats", "ender_chest", "state" FROM "main"."_user_old_20230312";`,
            
            `CREATE INDEX "main"."user_guid"
            ON "user" (
              "guid" ASC
            );`,
            
            `CREATE INDEX "main"."user_is_admin"
            ON "user" (
              "is_admin" ASC
            );`,

            `DROP TABLE "_user_old_20230312"`

        ]});

        migrations.push({version: 95, queries: [
            'UPDATE user SET chunk_render_dist = 5 WHERE chunk_render_dist = 4;'
        ]});

        migrations.push({version: 96, queries: [
            'ALTER TABLE user ADD COLUMN world_data TEXT DEFAULT NULL'
        ]});

        migrations.push({version: 97, queries: [
            `ALTER TABLE world ADD COLUMN "tech_info" TEXT DEFAULT '{"chunk_size": {"x":16,"y":40,"z":16}}'`,
        ]});

        migrations.push({version: 98, queries: [
            `UPDATE entity SET type = 'mob/' || type WHERE type NOT LIKE'mob/%'`
        ]});

        migrations.push({version: 99, queries: [
            `UPDATE entity SET skin = 'npc_1.png' WHERE skin = '1';`,
            `UPDATE entity SET skin = 'npc_2.png' WHERE skin = '2';`,
            `UPDATE entity SET skin = 'npc_3.png' WHERE skin = '3';`,
            `UPDATE entity SET skin = 'npc_4.png' WHERE skin = '4';`,
            `UPDATE entity SET skin = 'npc_5.png' WHERE skin = '5';`,
            `UPDATE entity SET skin = 'npc_6.png' WHERE skin = '6';`,
            `UPDATE entity SET skin = 'npc_7.png' WHERE skin = '7';`,
            `UPDATE entity SET skin = 'npc_8.png' WHERE skin = '8';`,
            `UPDATE entity SET skin = 'npc_9.png' WHERE skin = '9';`,
            `UPDATE entity SET skin = 'npc_10.png' WHERE skin = '10';`,
        ]});

        migrations.push({version: 100, queries: [
            `CREATE TABLE "driving" (
              "id" INTEGER PRIMARY KEY AUTOINCREMENT,
              "data" TEXT NOT NULL
            );`,
            `ALTER TABLE entity ADD COLUMN driving_id INTEGER DEFAULT NULL;`,
            `ALTER TABLE user   ADD COLUMN driving_id INTEGER DEFAULT NULL;`
        ]});

        migrations.push({version: 101, queries: [
            // добавить пояс и рюкзак старым игрокам
            async function (db: DBConnection): Promise<[]> {
                const src: { id: int, inventory: string }[] = await db.all('SELECT id, inventory FROM user')
                const dst = []
                for(const user of src) {
                    const inventory: TInventoryState = JSON.parse(user.inventory)
                    const items = inventory.items
                    if (items[PAPERDOLL_BACKPACK]?.id !== BLOCK_IDS.BACKPACK_BASIC || items[PAPERDOLL_TOOLBELT]?.id !== BLOCK_IDS.TOOLBELT_BASIC) {
                        items.push(...new Array(INVENTORY_SLOT_COUNT - items.length).fill(null))
                        items[PAPERDOLL_BACKPACK] = {id: BLOCK_IDS.BACKPACK_BASIC, count: 1}
                        items[PAPERDOLL_TOOLBELT] = {id: BLOCK_IDS.TOOLBELT_BASIC, count: 1}
                        dst.push([user.id, JSON.stringify(inventory)])
                    }
                }
                const sql = preprocessSQL('UPDATE user SET inventory = %1 FROM json_each(?) WHERE user.id = %0')
                await db.run(sql, [JSON.stringify(dst)])
                return []
            }
        ]});

        migrations.push({version: 102, queries: [
            `DELETE from world_modify_chunks;`
        ]});

        migrations.push({version: 103, queries: [
            `ALTER TABLE quest_action ADD COLUMN params TEXT NOT NULL DEFAULT '{}'`,

            // квест на дубовые бревна => любые бревна
            `UPDATE quest_action SET params = '{"block_suffixes":["_LOG"],"cnt":5}', description = '{"ru":"Добыть 5 брёвен","en":"Mine 5 logs"}' WHERE id = 1`,
            `UPDATE quest_action SET params = '{"block_id":18,"cnt":20}' WHERE id = 2`,
            `UPDATE quest_action SET params = '{"block_id":58,"cnt":1}' WHERE id = 3`,
            `UPDATE quest_action SET params = '{"block_id":58,"cnt":1}' WHERE id = 4`,
            // тут только удалено слово дубовые/oak по сравнению с врсией 51
            `UPDATE quest SET title = '{"ru":"Добыть брёвна","en":"Get logs"}', description = '{"ru":"Необходимо добыть бревна. После этого вы сможете скрафтить орудия, для дальнейшего развития.\\r\\n\\r\\n1-й шаг — Найдите дерево\\r\\nНайдите любое дерево, подойдите к нему так близко, чтобы вокруг блока древесины, на которую вы нацелены появилась тонкая обводка. Зажмите левую кнопку мыши и не отпускайте, пока не будет добыто бревно.\\r\\nЧтобы сломать бревно рукой нужно примерно 6 секунд.\\r\\n\\r\\n2-й шаг — Подберите блок\\r\\nПодойдите ближе к выпавшему блоку, он попадёт в ваш инвентарь.","en":"You need to get logs. After that, you can craft weapons for further development.\\r\\n\\r\\n1st step - Find a tree\\r\\nFind any tree, get close enough to it so that a thin outline appears around the block of wood you are aiming at. Hold down the left mouse button and do not release until the log is mined.\\r\\nIt takes about 6 seconds to break a log by hand.\\r\\n\\r\\n2nd step - Pick up a block\\r\\nGet closer to the dropped block, it will go into your inventory."}'  WHERE id = 1`,

            // квест на создание примитивного топора - после крафт стола, параллельно с квестом на копание земли, после него - камни
            `INSERT INTO quest (id, quest_group_id, title, description, next_quests) VALUES (4, 1, '{"ru":"Создать примитивный топор","en":"Craft a primitive axe"}', ` +
            `'{"ru":"Чтобы добыть большие камни, нужен инструмент. Для начала и примитивный топор сойдет.\\r\\n\\r\\n` +
            `1-й шаг - Найдите любые блоки камней или руды. Разбив их, получите маленькие камни.\\r\\n` +
            `2-й шаг - Из палки и меленького камня, создайте примитивный топор. Если нужно, палку можно получить из досок.\\r\\n\\r\\n` +
            `Попробуйте разбить те же блоки камней или руды, но уже топором - результат будет отличаться.\\r\\n\\r\\n` +
            `Чтобы добыть редкие руды и разрушать блоки быстрее, нужны инструменты из лучших материалов или другой формы.",` +
            `"en":"To mine big stones, you need tools. For starters, a primitive axe would do.\\r\\n\\r\\n` +
            `1st step - Find any ore or stone blocks. Break it to get small rocks.\\r\\n` +
            `2nd step - Craft a primitive axe from a small rock and a stick. A stick can be crafted from planks if needed.\\r\\n\\r\\n` +
            `Try to break the same ore or stone blocks with the axe - the result will be different.\\r\\n\\r\\n` +
            `To mine rare ores, or to break blocks faster, better tools or different shape tools are needed."}', '[5]')`,
            `UPDATE quest SET next_quests = '[2, 4]' WHERE id = 3`,
            `INSERT INTO quest_action (quest_id, quest_action_type_id, block_id, cnt, params, description) VALUES
                (4, 1, 1087, 1, '{"block_id":1087,"cnt":1}', '{"ru":"Добыть маленькие камни","en":"Mine small rocks"}'),
                (4, 2, 798, 1, '{"block_id":798,"cnt":1}', '{"ru":"Создать примитивный топор","en":"Craft a primitive axe"}')`,
            `INSERT INTO quest_reward (quest_id, block_id, cnt) VALUES (4, 798, 2)`, // награда - еще 2 примитивных топора

            // квест на добычу камней
            `INSERT INTO quest (id, quest_group_id, title, description) VALUES (5, 1, '{"ru":"Добыть камни","en":"Mine stones"}', ` +
            `'{"ru":"Имея примитивный топор, пришло время добыть камни!", "en":"Having a primitive axe, it''s time to mine some stones!"}')`,
            `INSERT INTO quest_action (quest_id, quest_action_type_id, block_id, cnt, params, description) VALUES
                (5, 1, 9, 5, '{"block_id":9,"cnt":5}', '{"ru":"Добыть камни","en":"Mine stones"}')`,
            `INSERT INTO quest_reward (quest_id, block_id, cnt) VALUES (5, 9, 8)`
        ]})

        migrations.push({version: 104, queries: [
            `ALTER TABLE world ADD COLUMN state TEXT NOT NULL DEFAULT '{}'`
        ]})

        for(let m of migrations) {
            if(m.version > version) {
                await this.db.get('begin transaction');
                for(let query of m.queries) {
                    if (typeof query === 'string') {
                        await run(this.db, query);
                    } else if(query instanceof Function) {
                        for(let sub_query of await query(this.db)) {
                            await run(this.db, sub_query)
                        }
                    } else {
                        await run(this.db, query.sql, query.placeholders);
                    }
                }
                await this.db.get('UPDATE options SET version = ' + (++version));
                await this.db.get('commit');
                // Auto vacuum
                await this.db.get('VACUUM');
                version = m.version;
                console.debug('Migration applied: ' + version);
            }
        }

        // Create temporary table for bulk insert block modificators
        this.db.run(`CREATE TEMPORARY TABLE IF NOT EXISTS world_modify_import_bulk(data TEXT);`);

    }

}