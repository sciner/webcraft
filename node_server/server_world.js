import config from "./config.js";

import { Brains } from "./fsm/index.js";
import { DropItem } from "./drop_item.js";
import { ServerChat } from "./server_chat.js";
import { ModelManager } from "./model_manager.js";
import { PlayerEvent } from "./player_event.js";
import { QuestManager } from "./quest/manager.js";
import { TickerHelpers, BlockListeners } from "./ticker/ticker_helpers.js";

import { WorldTickStat } from "./world/tick_stat.js";
import { WorldPacketQueue } from "./world/packet_queue.js";
import { WorldActionQueue } from "./world/action_queue.js";
import { WorldMobManager } from "./world/mob_manager.js";
import { WorldAdminManager } from "./world/admin_manager.js";
import { WorldChestManager } from "./world/chest_manager.js";

import { ArrayHelpers, getChunkAddr, Vector, VectorCollector } from "../www/js/helpers.js";
import { AABB } from "../www/js/core/AABB.js";
import { BLOCK } from "../www/js/blocks.js";
import { ServerClient } from "../www/js/server_client.js";
import { PLAYER_STATUS_DEAD, PLAYER_STATUS_ALIVE } from "../www/js/player.js";
import { ServerChunkManager } from "./server_chunk_manager.js";
import { PacketReader } from "./network/packet_reader.js";
import { GAME_DAY_SECONDS, GAME_ONE_SECOND, WORLD_TYPE_BUILDING_SCHEMAS } from "../www/js/constant.js";
import { Weather } from "../www/js/block_type/weather.js";
import { TreeGenerator } from "./world/tree_generator.js";
import { GameRule } from "./game_rule.js";

import { WorldAction } from "../www/js/world_action.js";
import { BuildingTemplate } from "../www/js/terrain_generator/cluster/building_template.js";
import { WorldOreGenerator } from "./world/ore_generator.js";
import { ServerPlayerManager } from "./server_player_manager.js";
import { shallowCloneAndSanitizeIfPrivate } from "../www/js/compress/world_modify_chunk.js";
import { TBlock } from "../www/js/typed_blocks3.js";
import { Effect } from "../www/js/block_type/effect.js";

// for debugging client time offset
export const SERVE_TIME_LAG = config.Debug ? (0.5 - Math.random()) * 50000 : 0;

export class ServerWorld {

    constructor(block_manager) {
        this.temp_vec = new Vector();

        this.block_manager = block_manager;
        this.updatedBlocksByListeners = [];
    }

    async initServer(world_guid, db_world, new_title) {
        if (SERVE_TIME_LAG) {
            console.log('[World] Server time lag ', SERVE_TIME_LAG);
        }
        const newTitlePromise = new_title ? db_world.setTitle(new_title) : Promise.resolve();
        var t = performance.now();
        // Tickers
        this.tickers = new Map();
        for(let fn of config.tickers) {
            await import(`./ticker/${fn}.js`).then((module) => {
                this.tickers.set(module.default.type, module.default.func);
            });
        }
        // Random tickers
        this.random_tickers = new Map();
        for(let fn of config.random_tickers) {
            await import(`./ticker/random/${fn}.js`).then((module) => {
                this.random_tickers.set(fn, module.default);
            });
        }
        // Block listeners & callees
        this.blockListeners = new BlockListeners();
        await this.blockListeners.loadAll(config);
        this.blockCallees = this.blockListeners.calleesById;
        // Brains
        this.brains = new Brains();
        for(let fn of config.brains) {
            await import(`./fsm/brain/${fn}.js`).then((module) => {
                this.brains.add(fn, module.Brain);
            });
        }
        t = performance.now() - t;
        if (t > 50) {
            console.log('Importing tickers, listeners & brains: ' + t + ' ms');
        }
        //
        this.db             = db_world;
        this.db.removeDeadDrops();
        await newTitlePromise;
        this.info           = await this.db.getWorld(world_guid);

        await this.makeBuildingsWorld()

        // Server ore generator
        this.ore_generator  = new WorldOreGenerator(this.info.ore_seed, false)
        delete(this.info.ore_seed)

        //
        this.packet_reader  = new PacketReader();
        this.models         = new ModelManager();
        this.chat           = new ServerChat(this);
        this.chunks         = new ServerChunkManager(this, this.random_tickers);
        this.quests         = new QuestManager(this);
        this.actions_queue  = new WorldActionQueue(this);
        this.admins         = new WorldAdminManager(this);
        this.chests         = new WorldChestManager(this);
        this.mobs           = new WorldMobManager(this);
        this.packets_queue  = new WorldPacketQueue(this);
        // statistics
        this.ticks_stat     = new WorldTickStat();
        this.network_stat   = {in: 0, out: 0, in_count: 0, out_count: 0};
        this.start_time     = performance.now();
        this.weather_update_time = 0;
        this.info.calendar  = {age: 0, day_time: 0};
        this.rules          = new GameRule(this);
        //
        this.weather        = Weather.CLEAR;
        //
        this.players        = new ServerPlayerManager(this);
        this.all_drop_items = new Map(); // Store refs to all loaded drop items in the world
        //
        await this.models.init();
        await this.quests.init();
        await this.admins.load();
        await this.restoreModifiedChunks();
        await this.db.fluid.restoreFluidChunks();
        await this.chunks.initWorker();
        await this.chunks.initWorkers(world_guid);

        //
        if(this.isBuildingWorld()) {
            await this.rules.setValue('doDaylightCycle', 'false')
            await this.rules.setValue('doWeatherCycle', 'false')
            await this.rules.setValue('randomTickSpeed', '0')
        }

        //
        this.saveWorldTimer = setInterval(() => {
            // let pn = performance.now();
            this.save();
            // calc time elapsed
            // console.log("Save took %sms", Math.round((performance.now() - pn) * 1000) / 1000);
        }, 5000);
        await this.tick();
    }

    getDefaultPlayerIndicators() {
        return this.db.getDefaultPlayerIndicators();
    }

    isBuildingWorld() {
        return this.info.world_type_id == WORLD_TYPE_BUILDING_SCHEMAS
    }

    /**
     * @returns {boolean}
     */
    async makeBuildingsWorld() {

        if(!this.isBuildingWorld()) {
            return false
        }

        // flush database
        await this.db.flushWorld()

        const blocks = [];
        const chunks_addr = new VectorCollector()
        const block_air = {id: 0}
        const block_road = {id: 98}
        const block_smooth_stone = {id: 70}
        const block_num1 = {id: 209}
        const block_num2 = {id: 210}

        const addBlock = (pos, item) => {
            blocks.push({pos, item})
            chunks_addr.set(getChunkAddr(pos), true);
        }

        // make road
        for(let x = 10; x > -1000; x--) {
            addBlock(new Vector(x, 0, 3), block_road)
            addBlock(new Vector(x, 0, 4), block_smooth_stone)
            addBlock(new Vector(x, 0, 5), block_road)
        }

        // each all buildings
        for(let schema of BuildingTemplate.schemas.values()) {
            addBlock(new Vector(schema.world.pos1), block_num1)
            addBlock(new Vector(schema.world.pos2), block_num2)
            // draw sign
            const sign_z = schema.world.pos1.z < 3 ? 3 : 5
            const sign_rot_x = schema.world.pos1.z < 3 ? 0 : 2
            addBlock(new Vector(schema.world.pos1.x, 1, sign_z), {id: 645, extra_data: {text: schema.name, username: this.info.title, dt: new Date().toISOString()}, rotate: new Vector(sign_rot_x, 1, 0)})
            // clear basement level
            for(let x = 0; x <= (schema.world.pos1.x - schema.world.pos2.x); x++) {
                for(let z = 0; z <= (schema.world.pos1.z - schema.world.pos2.z); z++) {
                    const pos = new Vector(schema.world.pos1.x - x, 0, schema.world.pos1.z - z)
                    if(!pos.equal(schema.world.pos1) && !pos.equal(schema.world.pos2)) {
                        addBlock(pos, block_air)
                    }
                }
            }
            // fluids
            if('fluids' in schema && schema.fluids.length > 0) {
                const fluids = Array.from(schema.fluids)
                const y = schema.world.entrance.y - schema.door_pos.y - 1
                for(let i = 0; i < fluids.length; i += 4) {
                    fluids[i + 0] = schema.world.entrance.x - fluids[i + 0]
                    fluids[i + 1] = schema.world.pos1.y + fluids[i + 1] - y
                    fluids[i + 2] = schema.world.entrance.z - fluids[i + 2]
                }
                // TODO: need to store fluids in DB
                // let chunks = this.chunkManager.fluidWorld.applyWorldFluidsList(actions.fluids);
            }
            // fill blocks
            for(let b of schema.blocks) {
                const item = {id: b.block_id};
                const y = schema.world.entrance.y - schema.door_pos.y - 1
                const pos = new Vector(
                    schema.world.entrance.x - b.move.x,
                    schema.world.pos1.y + b.move.y - y,
                    schema.world.entrance.z - b.move.z
                )
                if(b.extra_data) item.extra_data = b.extra_data
                if(b.rotate) item.rotate = b.rotate
                addBlock(pos, item)
            }
        }

        // store modifiers in db
        let t = performance.now()
        await this.db.blockSetBulk(this, null, blocks)
        console.log('Building: store modifiers in db ...', performance.now() - t)

        // compress chunks in db
        t = performance.now()
        await this.db.updateChunks(chunks_addr.keys());
        console.log('Building: compress chunks in db ...', performance.now() - t)

        // reread info
        this.info = await this.db.getWorld(this.info.guid)

        return true

    }

    get serverTime() {
        return Date.now() + SERVE_TIME_LAG;
    }

    // Return world info
    getInfo() {
        return this.info;
    }

    // Спавн враждебных мобов в тёмных местах (пока тёмное время суток)
    autoSpawnHostileMobs() {
        const SPAWN_DISTANCE = 16;
        const good_world_for_spawn = !this.isBuildingWorld();
        const auto_generate_mobs = this.getGeneratorOptions('auto_generate_mobs', true);
        // не спавним мобов в мире-конструкторе и в дневное время
        if(!auto_generate_mobs || !good_world_for_spawn) {
            return;
        }
        // находим игроков
        for (const [_, player] of this.players.all()) {
            if (!player.game_mode.isSpectator() && player.status !== PLAYER_STATUS_DEAD) {
                // количество мобов одного типа в радусе спауна
                const mobs = this.getMobsNear(player.state.pos, SPAWN_DISTANCE, ['zombie', 'skeleton']);
                if (mobs.length <= 4) {
                    // TODO: Вот тут явно проблема, поэтому зомби спавняться близко к игроку!
                    // выбираем рандомную позицию для спауна
                    const x = player.state.pos.x + SPAWN_DISTANCE * (Math.random() - Math.random());
                    const y = player.state.pos.y + 2 * (Math.random());
                    const z = player.state.pos.z + SPAWN_DISTANCE * (Math.random() - Math.random());
                    const spawn_pos = new Vector(x, y, z).floored();
                    // проверка места для спауна
                    const under = this.getBlock(spawn_pos.offset(0, -1, 0));
                    // под ногами только твердый, целый блок
                    if (under && (under.id != 0 || under.material.style_name == 'planting')) {
                        const body = this.getBlock(spawn_pos);
                        const head = this.getBlock(spawn_pos.offset(0, 1, 0));
                        if (this.getLight() > 6) {
                            // console.log((head.lightValue >> 8))
                            if ((head.lightValue >> 8) != 0xFF) {
                                return;
                            }
                        }
                        // проверям что область для спауна это воздух или вода
                        if (body && head && body.id == 0 && head.id == 0) {
                            // не спавним рядом с игроком
                            const players = this.getPlayersNear(spawn_pos, 10);
                            if (players.length == 0) {
                                // тип мобов для спауна
                                const type_mob = (Math.random() < 0.5) ? 'zombie' : 'skeleton';
                                spawn_pos.addSelf(new Vector(0.5, 0, 0.5));
                                const params = {
                                    type:       type_mob,
                                    skin:       'base',
                                    pos:        spawn_pos,
                                    pos_spawn:  spawn_pos,
                                    rotate:     0,
                                };
                                const actions = new WorldAction(null, this, false, false);
                                actions.spawnMob(params);
                                this.actions_queue.add(null, actions);
                                console.log('Auto spawn ' + type_mob + ' pos spawn: ' + spawn_pos);
                            }
                        }
                    }

                }
            }
        }
    }

    // Update world wather
    updateWorldWeather() {
        const MIN_TIME_RAIN = 30;
        const MAX_TIME_RAIN = 12 * 60;
        const MIN_TIME_WITHOUT_RAIN = 1 * 60;
        const MAX_TIME_WITHOUT_RAIN = 1 * 2 * 60;
        const time = (Date.now() * GAME_ONE_SECOND / 60000);
        if (!this.rules.getValue('doWeatherCycle') || time < this.weather_update_time) {
            return;
        }
        if (this.weather == Weather.CLEAR) {
            this.weather_update_time = (Math.random() * MAX_TIME_RAIN) | 0 + MIN_TIME_RAIN + time;
            if (Math.random() < 0.2) {
                this.setWeather(Weather.RAIN);
            }
        } else {
            this.weather_update_time = (Math.random() * MAX_TIME_WITHOUT_RAIN) | 0 + MIN_TIME_WITHOUT_RAIN + time;
            this.setWeather(Weather.CLEAR);
        }
    }

    // Update world calendar
    updateWorldCalendar() {
        if(!this.info.calendar) {
            this.info.calendar = {
                age: null,
                day_time: null
            };
        }
        const currentTime = ((+new Date()) / 1000) | 0;
        // возраст в реальных секундах
        const diff_sec = currentTime - this.info.dt;
        // один игровой день в реальных секундах
        const game_day_in_real_seconds = 86400 / GAME_ONE_SECOND // 1200
        // возраст в игровых днях
        let add = (this.info.add_time / GAME_DAY_SECONDS);
        const age = diff_sec / game_day_in_real_seconds + add;
        // возраст в ЦЕЛЫХ игровых днях
        this.info.calendar.age = Math.floor(age);
        // количество игровых секунд прошедших в текущем игровом дне
        this.info.calendar.day_time = Math.round((age - this.info.calendar.age) * GAME_DAY_SECONDS);
    }

    // World tick
    async tick() {
        const started = performance.now();
        let delta = 0;
        if (this.pn) {
            delta = (performance.now() - this.pn) / 1000;
        }
        this.pn = performance.now();
        this.updateWorldCalendar();
        this.updateWorldWeather();
        if(!this.pause_ticks) {
            //
            this.ticks_stat.number++;
            this.ticks_stat.start();
            // 1.
            await this.chunks.tick(this.ticks_stat.number);
            this.ticks_stat.add('chunks');
            // 1.
            this.chunks.randomTick(this.ticks_stat.number);
            this.ticks_stat.add('chunks_random_tick');
            // 2.
            await this.mobs.tick(delta);
            this.ticks_stat.add('mobs');
            // 3.
            for(const [_, player] of this.players.all()) {
                await player.tick(delta, this.ticks_stat.number);
            }
            this.ticks_stat.add('players');
            //
            await this.chunks.fluidWorld.queue.process();
            this.ticks_stat.add('fluid_queue');
            // 4.
            this.chunks.itemWorld.tick(delta);
            this.ticks_stat.add('drop_items');
            // 6.
            await this.packet_reader.queue.process();
            this.ticks_stat.add('packet_reader_queue');
            //
            await this.actions_queue.run();
            this.ticks_stat.add('actions_queue');
            //
            this.packets_queue.send();
            this.ticks_stat.add('packets_queue_send');
            //
            if(this.ticks_stat.number % 100 == 0) {
                this.chunks.checkDestroyMap();
                this.ticks_stat.add('maps_clear');
            }
            // Auto spawn hostile mobs
            if(this.ticks_stat.number % 100 == 0) {
                this.autoSpawnHostileMobs();
                this.ticks_stat.add('auto_spawn_hostile_mobs');
            }
            // Save fluids
            this.ticks_stat.add('db_fluid_save');
            await this.db.fluid.saveFluids();
            this.ticks_stat.end();
        }
        //
        const elapsed = performance.now() - started;
        setTimeout(async () => {
            await this.tick();
        },
            elapsed < 50 ? (50 - elapsed) : 1
        );
    }

    save() {
        for(const [_, player] of this.players.all()) {
            this.db.savePlayerState(player);
        }
    }

    // onPlayer
    async onPlayer(player, skin) {
        // 1. Delete previous connections
        const existing_player = this.players.get(player.session.user_id);
        if(existing_player) {
            console.log('OnPlayer delete previous connection for: ' + player.session.username);
            await this.onLeave(existing_player);
        }
        // 2. Insert to DB if new player
        player.init(await this.db.registerPlayer(this, player));
        player.state.skin = skin;
        player.updateHands();
        await player.initQuests();
        player.initWaitingDataForSpawn();
        // 3. Insert to array
        this.players.list.set(player.session.user_id, player);
        // 4. Send about all other players
        const all_players_packets = [];
        for (const [_, p] of this.players.all()) {
            if (p.session.user_id != player.session.user_id) {
                all_players_packets.push({
                    name: ServerClient.CMD_PLAYER_JOIN,
                    data: p.exportState()
                });
            }
        }
        player.sendPackets(all_players_packets);
        // 5. Send to all about new player
        this.sendAll([{
            name: ServerClient.CMD_PLAYER_JOIN,
            data: player.exportState()
        }], []);
        // 6. Write to chat about new player
        this.chat.sendSystemChatMessageToSelectedPlayers(`player_connected|${player.session.username}`, this.players.keys());
        // 7. Drop item if stored
        if (player.inventory.moveOrDropFromDragSlot()) {
            await player.inventory.save();
        }
        // 8. Send CMD_CONNECTED
        player.sendPackets([{
            name: ServerClient.CMD_CONNECTED, data: {
                session: player.session,
                state: player.state,
                status: player.status,
                inventory: {
                    current: player.inventory.current,
                    items: player.inventory.items
                }
            }
        }]);
        // 9. Add night vision for building world
        if(this.isBuildingWorld()) {
            player.sendPackets([player.effects.addEffects([{id: Effect.NIGHT_VISION, level: 1, time: 8 * 3600}], true)])
        }
        // 10. Check player visible chunks
        this.chunks.checkPlayerVisibleChunks(player, true);
    }

    // onLeave
    async onLeave(player) {
        if (this.players.exists(player?.session?.user_id)) {
            this.players.delete(player.session.user_id);
            await this.db.savePlayerState(player);
            player.onLeave();
            // Notify other players about leave me
            const packets = [{
                name: ServerClient.CMD_PLAYER_LEAVE,
                data: {
                    id: player.session.user_id
                }
            }];
            this.sendAll(packets, [player.session.user_id]);
        }
    }

    /**
     * Send commands for all except player id list
     * @param {Object[]} packets
     * @param {number[]} except_players  ID of players
     * @return {void}
     */
    sendAll(packets, except_players) {
        for (const [_, player] of this.players.all()) {
            if (except_players && except_players.indexOf(player.session.user_id) >= 0) {
                continue;
            }
            player.sendPackets(packets);
        }
    }

    /**
     * Отправить только указанным
     * @param {Object[]} packets
     * @param {number[]} selected_players ID of players
     * @param {number[]} except_players  ID of players
     * @return {void}
     */
    sendSelected(packets, selected_players, except_players) {
        for(let user_id of selected_players) {
            if (except_players && except_players.indexOf(user_id) >= 0) {
                continue;
            }
            const player = this.players.get(user_id);
            if (player) {
                player.sendPackets(packets);
            }
        }
        return true;
    }

    //
    sendUpdatedInfo() {
        for(const [_, player] of this.players.all()) {
            player.sendWorldInfo(true);
        }
    }

    // Create drop items
    async createDropItems(player, pos, items, velocity) {
        try {
            const drop_item = await DropItem.create(this, pos, items, velocity);
            this.chunks.get(drop_item.chunk_addr)?.addDropItem(drop_item);
            return true;
        } catch (e) {
            const packets = [{
                name: ServerClient.CMD_ERROR,
                data: {
                    message: e
                }
            }];
            if(player) {
                this.sendSelected(packets, [player.session.user_id], []);
            }
        }
    }

    /**
     * Restore modified chunks list
     */
    async restoreModifiedChunks() {
        this.chunkModifieds = new VectorCollector();
        const list = await this.db.chunkBecameModified();
        for(let addr of list) {
            this.chunkBecameModified(addr);
        }
        return true;
    }

    // Chunk has modifiers
    chunkHasModifiers(addr) {
        return this.chunkModifieds.has(addr) || this.db.fluid.knownFluidChunks.has(addr);
    }

    // Add chunk to modified
    chunkBecameModified(addr) {
        if (this.chunkModifieds.has(addr)) {
            return false;
        }
        return this.chunkModifieds.set(addr, addr);
    }

    // Юзер начал видеть этот чанк
    async loadChunkForPlayer(player, addr) {
        const chunk = this.chunks.get(addr);
        if (!chunk) {
            throw 'Chunk not found';
        }
        chunk.addPlayerLoadRequest(player);
    }

    /**
     * Returns block on world pos, or null.
     * @param {Vector} pos
     * @returns {TBlock}
     */
    getBlock(pos, resultBlock = null) {
        const chunk = this.chunks.getByPos(pos);
        return chunk ? chunk.getBlock(pos, resultBlock) : null;
    }

    getMaterial(pos) {
        const chunk = this.chunks.getByPos(pos);
        return chunk ? chunk.getMaterial(pos) : null;
    }

    /**
     * @return {ServerChunkManager}
     */
    get chunkManager() {
        return this.chunks;
    }

    //
    async applyActions(server_player, actions) {
        const chunks_packets = new VectorCollector();
        //
        const getChunkPackets = (pos) => {
            const chunk_addr = getChunkAddr(pos);
            const chunk = this.chunks.get(chunk_addr);
            let cps = chunks_packets.get(chunk_addr);
            if (!cps) {
                cps = {
                    chunk: chunk,
                    packets: [],
                    custom_packets: []
                };
                chunks_packets.set(chunk_addr, cps);
            }
            return cps;
        };
        // Send message to chat
        if (actions.chat_message) {
            this.chat.sendMessage(server_player, actions.chat_message);
        }
        // Decrement item
        if (actions.decrement) {
            server_player.inventory.decrement(actions.decrement, actions.ignore_creative_game_mode);
        }
        // Decrement (extended)
        if (actions.decrement_extended) {
            server_player.inventory.decrementExtended(actions.decrement_extended);
        }
        // Decrement instrument
        if (actions.decrement_instrument) {
            server_player.inventory.decrement_instrument(actions.decrement_instrument);
        }
        // increment item
        if (actions.increment) {
            server_player.inventory.increment(actions.increment);
        }
        // Stop playing discs
        if (Array.isArray(actions.stop_disc) && actions.stop_disc.length > 0) {
            for (let params of actions.stop_disc) {
                const cps = getChunkPackets(params.pos);
                if (cps) {
                    if (cps.chunk) {
                        cps.packets.push({
                            name: ServerClient.CMD_STOP_PLAY_DISC,
                            data: actions.stop_disc
                        });
                    }
                }
            }
        }
        // Create drop items
        if (actions.drop_items && actions.drop_items.length > 0) {
            for (let di of actions.drop_items) {
                if (di.force || server_player.game_mode.isSurvival()) {
                    // Add velocity for drop item
                    this.temp_vec = this.temp_vec.set(
                        Math.random() - Math.random(),
                        Math.random() * 0.75,
                        Math.random() - Math.random()
                    ).normalize().multiplyScalarSelf(0.375);
                    this.createDropItems(server_player, di.pos, di.items, this.temp_vec);
                }
            }
        }
        // @Warning Must be check before actions.blocks
        if(actions.generate_tree.length > 0) {
            for(let i = 0; i < actions.generate_tree.length; i++) {
                const params = actions.generate_tree[i];
                const treeGenerator = await TreeGenerator.getInstance();
                const chunk = this.chunks.get(getChunkAddr(params.pos.x, params.pos.y, params.pos.z));
                if(chunk) {
                    const new_tree_blocks = await treeGenerator.generateTree(this, chunk, params.pos, params.block);
                    if(new_tree_blocks) {
                        actions.addBlocks(new_tree_blocks);
                        // Delete completed block from tickings
                        chunk.ticking_blocks.delete(params.pos);
                    }
                }
            }
        }
        // Modify blocks
        if(actions.blocks?.list) {
            this.updatedBlocksByListeners.length = 0;
            // trick for worldedit plugin
            const ignore_check_air = (actions.blocks.options && 'ignore_check_air' in actions.blocks.options) ? !!actions.blocks.options.ignore_check_air : false;
            const on_block_set = actions.blocks.options && 'on_block_set' in actions.blocks.options ? !!actions.blocks.options.on_block_set : true;
            const use_tx = actions.blocks.list.length > 1;
            if (use_tx) {
                await this.db.TransactionBegin();
            }
            try {
                let chunk_addr = new Vector(0, 0, 0);
                let prev_chunk_addr = new Vector(Infinity, Infinity, Infinity);
                let chunk = null;
                const modified_chunks = new VectorCollector();
                const all = [];
                const create_block_list = [];
                const previous_item = {id: 0}
                for (let params of actions.blocks.list) {
                    params.item = this.block_manager.convertItemToDBItem(params.item);
                    chunk_addr = getChunkAddr(params.pos, chunk_addr);
                    if (!prev_chunk_addr.equal(chunk_addr)) {
                        chunk?.light?.flushDelta();
                        modified_chunks.set(chunk_addr, true);
                        chunk = this.chunks.get(chunk_addr);
                        prev_chunk_addr.set(chunk_addr.x, chunk_addr.y, chunk_addr.z);
                    }
                    if(params.action_id != ServerClient.BLOCK_ACTION_MODIFY) {
                        create_block_list.push(params);
                    } else {
                        all.push(this.db.blockSet(this, server_player, params));
                    }

                    let isLoaded = chunk && chunk.isReady();
                    if (chunk && !isLoaded) {
                        // TODO: wtf to do here? we are loading info from the database currently!
                        console.log(`Potential problem with setting a block and loading chunk pos=${params.pos} item=${params.item}`);
                    }
                    // 2. Mark as became modifieds
                    this.chunkBecameModified(chunk_addr);
                    // 3.
                    if (chunk && chunk.tblocks && isLoaded) {
                        let sanitizedParams = params;
                        const sanitizedItem = shallowCloneAndSanitizeIfPrivate(params.item);
                        if (sanitizedItem) {
                            // I'm not sure if params are used anywhere else, so shallow clone them to be safe.
                            sanitizedParams = {...params};
                            sanitizedParams.item = sanitizedItem;
                        }

                        const block_pos = new Vector(params.pos).flooredSelf();
                        const block_pos_in_chunk = block_pos.sub(chunk.coord);
                        const cps = getChunkPackets(params.pos);
                        cps.packets.push({
                            name: ServerClient.CMD_BLOCK_SET,
                            data: sanitizedParams
                        });
                        // 0. Play particle animation on clients
                        if (!ignore_check_air) {
                            if (params.action_id == ServerClient.BLOCK_ACTION_DESTROY) {
                                if (params.destroy_block_id > 0) {
                                    const except_players = [];
                                    if(server_player) except_players.push(server_player)
                                    cps.custom_packets.push({
                                        except_players,
                                        packets: [{
                                            name: ServerClient.CMD_PARTICLE_BLOCK_DESTROY,
                                            data: {
                                                pos: params.pos.add(new Vector(.5, .5, .5)),
                                                item: { id: params.destroy_block_id }
                                            }
                                        }]
                                    });
                                }
                            }
                        }
                        const tblock = chunk.tblocks.get(block_pos_in_chunk);
                        let oldId = tblock.id;
                        previous_item.id = oldId
                        // call block change listeners
                        if (on_block_set) {
                            const listeners = this.blockListeners.beforeBlockChangeListeners[oldId];
                            if (listeners) {
                                for(let listener of listeners) {
                                    const newMaterial = BLOCK.BLOCK_BY_ID[params.item.id];
                                    var res = listener.onBeforeBlockChange(chunk, tblock, newMaterial, true);
                                    if (typeof res === 'number') {
                                        chunk.addDelayedCall(listener.onBeforeBlockChangeCalleeId, res, [block_pos]);
                                    } else {
                                        TickerHelpers.pushBlockUpdates(this.updatedBlocksByListeners, res);
                                    }
                                }
                            }
                        }
                        // 4. Store in chunk tblocks
                        const oldLight = tblock.lightSource;
                        chunk.tblocks.delete(block_pos_in_chunk);
                        tblock.copyPropsFromPOJO(params.item);
                        const newLight = tblock.lightSource;
                        if (newLight !== oldLight) {
                            chunk.light.currentDelta.push(tblock.index);
                        }
                        // 5. Store in modify list
                        chunk.addModifiedBlock(block_pos, params.item);
                        if (on_block_set) {
                            // a.
                            chunk.onBlockSet(block_pos.clone(), params.item, previous_item);
                            // b. check destroy block near uncertain stones
                            if (params.action_id == ServerClient.BLOCK_ACTION_DESTROY) {
                                // Check uncertain stones
                                chunk.checkDestroyNearUncertainStones(block_pos.clone(), params.item, previous_item, actions.blocks.options.on_block_set_radius)
                            }
                            // c.
                            const listeners = this.blockListeners.afterBlockChangeListeners[tblock.id];
                            if (listeners) {
                                for(let listener of listeners) {
                                    const oldMaterial = BLOCK.BLOCK_BY_ID[oldId];
                                    const res = listener.onAfterBlockChange(chunk, tblock, oldMaterial, true);
                                    if (typeof res === 'number') {
                                        chunk.addDelayedCall(listener.onAfterBlockChangeCalleeId, res, [block_pos, oldMaterial.id]);
                                    } else {
                                        TickerHelpers.pushBlockUpdates(this.updatedBlocksByListeners, res);
                                    }
                                }
                            }
                        }
                        // 6. Trigger player
                        if (server_player) {
                            if (params.action_id == ServerClient.BLOCK_ACTION_DESTROY) {
                                PlayerEvent.trigger({
                                    type: PlayerEvent.DESTROY_BLOCK,
                                    player: server_player,
                                    data: { pos: params.pos, block_id: params.destroy_block_id }
                                });
                            } else if (params.action_id == ServerClient.BLOCK_ACTION_CREATE) {
                                PlayerEvent.trigger({
                                    type: PlayerEvent.SET_BLOCK,
                                    player: server_player,
                                    data: { pos: block_pos.clone(), block: params.item }
                                });
                            }
                        }
                    } else {
                        // TODO: Chunk not found in pos
                    }
                }
                chunk?.light?.flushDelta();
                if(create_block_list.length > 0) {
                    all.push(this.db.blockSetBulk(this, server_player, create_block_list));
                }
                await Promise.all(all);
                await this.db.updateChunks(Array.from(modified_chunks.keys()));
                if (use_tx) {
                    await this.db.TransactionCommit();
                }
            } catch(e) {
                console.error('error', e);
                if (use_tx) {
                    await this.db.TransactionRollback();
                }
                throw e;
            }
            this.addUpdatedBlocksActions(this.updatedBlocksByListeners);
        }
        if (actions.fluids.length > 0) {
            if (actions.fluidFlush) {
                await this.db.fluid.applyAnyChunk(actions.fluids);
                // assume same chunk for all cells
            } else {
                let chunks = this.chunkManager.fluidWorld.applyWorldFluidsList(actions.fluids);
                for (let chunk of chunks) {
                    chunk.sendFluid(chunk.fluid.saveDbBuffer());
                    chunk.fluid.markDirtyDatabase();
                }
            }
        }
        // Play sound
        if (actions.play_sound) {
            for(let params of actions.play_sound) {
                const cps = getChunkPackets(params.pos);
                if (cps) {
                    if (cps.chunk) {
                        if('except_players' in params) {
                            const except_players = params.except_players;
                            delete(params.except_players);
                            cps.custom_packets.push({
                                except_players,
                                packets: [{
                                    name: ServerClient.CMD_PLAY_SOUND,
                                    data: params
                                }]
                            });
                        } else {
                            cps.packets.push({
                                name: ServerClient.CMD_PLAY_SOUND,
                                data: params
                            });
                        }
                    }
                }
            }
        }
        // Generate particles
        if(actions.generate_particles) {
            for(let params of actions.generate_particles) {
                const cps = getChunkPackets(params.pos);
                if (cps) {
                    if (cps.chunk) {
                        if('except_players' in params) {
                            const except_players = params.except_players;
                            delete(params.except_players);
                            cps.custom_packets.push({
                                except_players,
                                packets: [{
                                    name: ServerClient.CMD_GENERATE_PARTICLE,
                                    data: params
                                }]
                            });
                        } else {
                            cps.packets.push({
                                name: ServerClient.CMD_GENERATE_PARTICLE,
                                data: params
                            });
                        }
                    }
                }
            }
        }
        // Put in bucket
        if(actions.put_in_backet) {
            const inventory = server_player.inventory;
            const currentInventoryItem = inventory.current_item;
            if(currentInventoryItem && currentInventoryItem.id == this.block_manager.BUCKET.id) {
                // replace item in inventory
                inventory.items[inventory.current.index] = actions.put_in_backet;
                // send new inventory state to player
                inventory.refresh(true);
                /*
                server_player.inventory.decrement(actions.decrement);
                console.log(server_player, actions.put_in_backet);
                */
            }
        }
        // Put in bottle
        if(actions.put_in_bottle) {
            const inventory = server_player.inventory;
            const currentInventoryItem = inventory.current_item;
            if(currentInventoryItem && currentInventoryItem.id == this.block_manager.GLASS_BOTTLE.id) {
                // replace item in inventory
                inventory.items[inventory.current.index] = actions.put_in_bottle;
                // send new inventory state to player
                inventory.refresh(true);
            }
        }
        //
        for (let cp of chunks_packets) {
            if (cp.chunk) {
                // send 1
                cp.chunk.sendAll(cp.packets, []);
                // send 2
                for (let i = 0; i < cp.custom_packets.length; i++) {
                    const item = cp.custom_packets[i];
                    cp.chunk.sendAll(item.packets, item.except_players || []);
                }
            }
        }
        // Sitting
        if(actions.sitting) {
            server_player.state.sitting = actions.sitting;
            server_player.state.lies = false;
            server_player.state.rotate = actions.sitting.rotate;
            server_player.state.pos = actions.sitting.pos;
            server_player.sendNearPlayers();
        }
        // Spawn mobs
        if(actions.mobs.spawn.length > 0) {
            for(let i = 0; i < actions.mobs.spawn.length; i++) {
                const params = actions.mobs.spawn[i];
                await this.mobs.create(params);
            }
        }
        // Activate mobs
        // мало кода, но работает медленнее ;)
        // actions.mobs.activate.map((_, v) => await this.mobs.activate(v.entity_id, v.spawn_pos, v.rotate));
        if(actions.mobs.activate.length > 0) {
            for(let i = 0; i < actions.mobs.activate.length; i++) {
                const params = actions.mobs.activate[i];
                await this.mobs.activate(params.entity_id, params.spawn_pos, params.rotate);
            }
        }
    }

    // Return generator options
    getGeneratorOptions(key, default_value) {
        const generator_options = this.info.generator.options;
        if (generator_options) {
            if (key in generator_options) {
                return generator_options[key];
            }
        }
        return default_value;
    }

    // Return players near pos by distance
    getPlayersNear(pos, max_distance, not_in_creative, in_spectator) {
        const world = this;
        const aabb = new AABB().set(pos.x, pos.y, pos.z, pos.x, pos.y, pos.z)
            .expand(max_distance, max_distance, max_distance);
        //
        const all_players = world.players;
        const chunks = world.chunks.getInAABB(aabb);
        const resp = new Map();
        //
        for(let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            for(let user_id of chunk.connections.keys()) {
                const player = all_players.get(user_id);
                if(!player) {
                    continue
                }
                if(player.status !== PLAYER_STATUS_ALIVE) {
                    continue;
                }
                if(!in_spectator && player.game_mode.isSpectator()) {
                    continue;
                }
                if(not_in_creative && !player.game_mode.mayGetDamaged()) {
                    continue;
                }
                const dist = new Vector(player.state.pos).distance(pos);
                if(dist <= max_distance) {
                    resp.set(user_id, player);
                }
            }
        }
        return Array.from(resp.values());
    }

    // Return mobs near pos by distance
    getMobsNear(pos, max_distance, filter_types = null) {
        const world = this;
        const aabb = new AABB().set(pos.x, pos.y, pos.z, pos.x, pos.y, pos.z)
            .expand(max_distance, max_distance, max_distance);
        //
        const chunks = world.chunks.getInAABB(aabb);
        const resp = new Map();
        //
        for(let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            for(const [mob_id, mob] of chunk.mobs) {
                if(filter_types)  {
                    if(Array.isArray(filter_types)) {
                        if(filter_types.indexOf(mob.type) < 0) continue;
                    } else {
                        if(filter_types !== mob.type) continue;
                    }
                }
                // @todo check if not dead
                const dist = new Vector(mob.pos).distance(pos);
                if(dist <= max_distance) {
                    resp.set(mob_id, mob);
                }
            }
        }
        return Array.from(resp.values());
    }

    // Return bee nests near pos by distance
    getBeeNestsNear(pos, max_distance) {
        const resp = [];
        for(const addr of this.chunkManager.ticking_chunks.keys()) {
            const chunk = this.chunkManager.get(addr);
            if(chunk) {
                for(const [_, ticking_block] of chunk.ticking_blocks.blocks.entries()) {
                    if(ticking_block.ticking.type == 'bee_nest') {
                        const tblock = this.getBlock(ticking_block.pos);
                        if(tblock && tblock.id > 0 && tblock.hasTag('bee_nest')) {
                            const dist = tblock.posworld.distance(pos);
                            if(dist <= max_distance) {
                                resp.push(tblock);
                            }
                        }
                    }
                }
            }
        }
        return resp;
    }

    /**
     * Set world global weather
     * @param {Weather} weather
     */
    setWeather(weather) {
        this.weather = weather;
        //
        this.sendAll([{
            name: ServerClient.CMD_SET_WEATHER,
            data: weather
        }], []);
    }

    //
    async setWorldSpawn(pos_spawn) {
        // Save to DB and send to players
        this.info.pos_spawn = pos_spawn;
        await this.db.setWorldSpawn(this.info.guid, pos_spawn);
        this.sendUpdatedInfo();
    }

    // Возвращает идет ли дождь или снег
    isRaining() {
        return this.weather != Weather.CLEAR;
    }

    // Возвращает уровень освещности в мире
    getLight() {
        const time = this.info.calendar.day_time;
        if (time < 6000 || time > 18000) {
            return 4;
        }
        if (this.isRaining()) {
            return 12;
        }
        return 15;
    }

    addUpdatedBlocksActions(updated_blocks) {
        ArrayHelpers.filterSelf(updated_blocks, v => v != null);
        if (updated_blocks.length) {
            const action = new WorldAction(null, this, false, true);
            action.addBlocks(updated_blocks);
            this.actions_queue.add(null, action);
        }
    }

}