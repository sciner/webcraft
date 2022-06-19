// Migrations
export class DBWorldMigration {

    constructor(db, world, getDefaultPlayerStats, getDefaultPlayerIndicators) {
        this.db = db;
        this.world = world;
        this.getDefaultPlayerStats = getDefaultPlayerStats;
        this.getDefaultPlayerIndicators = getDefaultPlayerIndicators;
    }

    //
    async apply() {
        let version = 0;
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
        const migrations = [];
        migrations.push({version: 1, queries: [
            'ALTER TABLE user ADD COLUMN indicators text',
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
            `alter table user add column "chunk_render_dist" integer DEFAULT 4`
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
        ]});

        for(let m of migrations) {
            if(m.version > version) {
                await this.db.get('begin transaction');
                for(let query of m.queries) {
                    if (typeof query === 'string') {
                        await this.db.get(query);
                    } else {
                        await this.db.run(query.sql, query.placeholders);
                    }
                }
                await this.db.get('UPDATE options SET version = ' + (++version));
                await this.db.get('commit');
                // Auto vacuum
                await this.db.get('VACUUM');
                version = m.version;
                console.info('Migration applied: ' + version);
            }
        }

    }

}