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
import { WorldDBActor } from "./db/world/WorldDBActor.js";
import { WorldChunkFlags } from "./db/world/WorldChunkFlags.js";
import { BLOCK_DIRTY } from "./db/world/ChunkDBActor.js";

import { ArrayHelpers, getChunkAddr, Vector, VectorCollector, PerformanceTimer } from "../www/src/helpers.js";
import { AABB } from "../www/src/core/AABB.js";
import { BLOCK, DBItemBlock } from "../www/src/blocks.js";
import { ServerClient } from "../www/src/server_client.js";
import { ServerChunkManager } from "./server_chunk_manager.js";
import { PacketReader } from "./network/packet_reader.js";
import { GAME_DAY_SECONDS, GAME_ONE_SECOND, PLAYER_STATUS, WORLD_TYPE_BUILDING_SCHEMAS } from "../www/src/constant.js";
import { Weather } from "../www/src/block_type/weather.js";
import { TreeGenerator } from "./world/tree_generator.js";
import { GameRule } from "./game_rule.js";
import { SHUTDOWN_ADDITIONAL_TIMEOUT } from "./server_constant.js"

import { WorldAction } from "../www/src/world_action.js";
import { BuildingTemplate } from "../www/src/terrain_generator/cluster/building_template.js";
import { WorldOreGenerator } from "./world/ore_generator.js";
import { ServerPlayerManager } from "./server_player_manager.js";
import { shallowCloneAndSanitizeIfPrivate } from "../www/src/compress/world_modify_chunk.js";
import { Effect } from "../www/src/block_type/effect.js";
import { MobSpawnParams } from "./mob.js";
import type { DBWorld } from "./db/world.js";
import type { TBlock } from "../www/src/typed_blocks3.js";
import type { ServerPlayer } from "./server_player.js";
import type { Indicators, PlayerConnectData, PlayerSkin } from "../www/src/player.js";

export const NEW_CHUNKS_PER_TICK = 50;

export class ServerWorld implements IWorld {
    temp_vec: Vector;
    block_manager: BLOCK;
    updatedBlocksByListeners: any[];
    shuttingDown: any;
    game: any;
    tickers: Map<string, any>;
    random_tickers: Map<string, any>;
    blockListeners: BlockListeners;
    blockCallees: any;
    brains: Brains;
    db: DBWorld;
    info: any;
    worldChunkFlags: WorldChunkFlags;
    dbActor: WorldDBActor;
    ore_generator: WorldOreGenerator;
    packet_reader: PacketReader;
    models: ModelManager;
    chat: ServerChat;
    chunks: ServerChunkManager;
    quests: QuestManager;
    actions_queue: WorldActionQueue;
    admins: WorldAdminManager;
    chests: WorldChestManager;
    mobs: WorldMobManager;
    packets_queue: WorldPacketQueue;
    ticks_stat: WorldTickStat;
    network_stat: {
        in: number; out: number; in_count: number; out_count: number;
        out_count_by_type?: int[]; in_count_by_type?: int[];
        out_size_by_type?: int[]; in_size_by_type?: int[];
    };
    start_time: number;
    weather_update_time: number;
    rules: GameRule;
    weather: number;
    players: ServerPlayerManager;
    all_drop_items: any;
    pn: any;
    pause_ticks: any;
    givePriorityToSavingFluids: any;
    /** An immutable shared instance of {@link getDefaultPlayerIndicators} */
    defaultPlayerIndicators: Indicators

    constructor(block_manager : BLOCK) {
        this.temp_vec = new Vector();

        this.block_manager = block_manager;
        this.updatedBlocksByListeners = [];

        // An object with fields { resolve, gentle }. Gentle means to wait unil the action queue is empty
        this.shuttingDown = null;
    }

    async initServer(world_guid : string, db_world : DBWorld, new_title : string, game) {
        this.game = game;
        if (SERVER_TIME_LAG) {
            console.log('[World] Server time lag ', SERVER_TIME_LAG);
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
        t = performance.now() - t | 0;
        if (t > 50) {
            console.log('Importing tickers, listeners & brains: ' + t + ' ms');
        }
        //
        this.db             = db_world;
        this.db.removeDeadDrops();
        await newTitlePromise;
        this.info           = await this.db.getWorld(world_guid);

        this.worldChunkFlags = new WorldChunkFlags(this);
        this.dbActor        = new WorldDBActor(this);

        const madeBuildings = await this.makeBuildingsWorld();

        if (!madeBuildings) {
            await this.dbActor.crashRecovery();
            await this.db.compressModifiers(); // Do we really need it?
        }

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
        this.network_stat   = {in: 0, out: 0, in_count: 0, out_count: 0,
            out_count_by_type: null, in_count_by_type: null,
            out_size_by_type: null, in_size_by_type: null };
        this.start_time     = performance.now();
        this.weather_update_time = 0;
        this.info.calendar  = {age: 0, day_time: 0};
        this.rules          = new GameRule(this);
        //
        this.weather        = Weather.CLEAR;
        //
        this.players        = new ServerPlayerManager(this);
        this.all_drop_items = this.chunks.itemWorld.all_drop_items; // Store refs to all loaded drop items in the world
        this.defaultPlayerIndicators = this.getDefaultPlayerIndicators()
        //
        await this.models.init();
        this.quests.init();
        await this.admins.load();
        t = performance.now();
        await this.worldChunkFlags.restore();
        await this.db.mobs.initChunksWithMobs();
        console.log(`Restored ${this.worldChunkFlags.size} chunks, ${this.db.mobs._addrByMobId.size} mobs, elapsed: ${performance.now() - t | 0} ms`)
        await this.chunks.initWorker();
        await this.chunks.initWorkers(world_guid);

        //
        if(this.isBuildingWorld()) {
            await this.rules.setValue('doDaylightCycle', 'false')
            await this.rules.setValue('doWeatherCycle', 'false')
            await this.rules.setValue('randomTickSpeed', '0')
        }

        await this.tick();
    }

    // Closes the world on a critical error. It must never resolve.
    async terminate(text, err) {
        text && console.error(text);
        err && console.error(err);
        if(typeof process == 'undefined') {
            console.log('process need to terminate')
        } else {
            process.exit();
        }
    }

    getDefaultPlayerIndicators(): Indicators {
        return this.db.getDefaultPlayerIndicators();
    }

    isBuildingWorld() : boolean {
        return this.info.world_type_id == WORLD_TYPE_BUILDING_SCHEMAS
    }

    async makeBuildingsWorld() : Promise<boolean> {

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
            chunks_addr.set(Vector.toChunkAddr(pos), true);
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
                const fluids = Array.from(schema.fluids) as number[]
                const y = schema.world.entrance.y - schema.door_pos.y - 1
                for(let i = 0; i < fluids.length; i += 4) {
                    fluids[i + 0] = schema.world.entrance.x - fluids[i + 0]
                    fluids[i + 1] = schema.world.pos1.y + fluids[i + 1] - y
                    fluids[i + 2] = schema.world.entrance.z - fluids[i + 2]
                }
                await this.db.fluid.flushWorldFluidsList(fluids)
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
                if(b.extra_data) (item as any).extra_data = b.extra_data
                if(b.rotate) (item as any).rotate = b.rotate
                addBlock(pos, item)
            }
        }

        // store modifiers in db
        let t = performance.now()
        await this.db.chunks.bulkInsertWorldModify(blocks)
        console.log('Building: store modifiers in db ...', performance.now() - t)

        // compress chunks in db
        t = performance.now()
        await this.db.chunks.insertRebuildModifiers(Array.from(chunks_addr.keys()))
        console.log('Building: compress chunks in db ...', performance.now() - t)

        // reread info
        this.info = await this.db.getWorld(this.info.guid)

        return true

    }

    get serverTime() : number {
        return Date.now() + SERVER_TIME_LAG;
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
        if(!auto_generate_mobs || !good_world_for_spawn || !this.rules.getValue('doMobSpawning')) {
            return;
        }
        const ambientLight = (this.info.rules.ambientLight || 0) * 255/15;
        // находим игроков
        for (const player of this.players.values()) {
            if (!player.game_mode.isSpectator() && player.status !== PLAYER_STATUS.DEAD) {
                // количество мобов одного типа в радиусе спауна
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
                        const lv = head.lightValue;
                        // if ((lv & 0xFF) > 0) {
                        //     continue;
                        // }
                        if ((lv & 0xff) > ambientLight) {
                            continue;
                        }
                        if (this.getLight() > 6) {
                            if (0xFF - (lv >> 8) > ambientLight) {
                                continue;
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
                                const params = new MobSpawnParams(spawn_pos, Vector.ZERO.clone(), type_mob, 'base')
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

    async shutdown() {
        await this.db.fluid.flushAll()
        await this.dbActor.forceSaveWorld()
        // resolve the promise of this world shutting down after an additional timeout
        setTimeout(this.shuttingDown.resolve, SHUTDOWN_ADDITIONAL_TIMEOUT)
        await new Promise(() => {}) // await forever
    }

    // World tick
    async tick() {
        if (this.shuttingDown && !this.shuttingDown.gentle) {
            await this.shutdown()
        }
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
            this.ticks_stat.add('chunks.tick');
            // 1.
            this.chunks.randomTick(this.ticks_stat.number);
            this.ticks_stat.add('chunks_random_tick');
            // 2.
            await this.mobs.tick(delta);
            this.ticks_stat.add('mobs');
            // 3.
            for(const player of this.players.values()) {
                await player.preTick(delta, this.ticks_stat.number);
            }
            this.ticks_stat.add('player.preTick');
            this.chunks.tickChunkQueue(NEW_CHUNKS_PER_TICK);
            this.ticks_stat.add('tickChunkQueue');
            for(const player of this.players.values()) {
                player.postTick(delta, this.ticks_stat.number);
            }
            this.ticks_stat.add('player.postTick');
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
            if (this.shuttingDown?.gentle && this.actions_queue.length === 0) {
                await this.shutdown()
            }
            //
            this.packets_queue.send();
            this.ticks_stat.add('packets_queue_send');

            // Do different periodic tasks in different ticks to reduce lag spikes
            if(this.ticks_stat.number % 100 == 0) {
                //
                this.chunks.checkDestroyMap();
                this.ticks_stat.add('maps_clear');
                // Auto spawn hostile mobs
                this.autoSpawnHostileMobs();
                this.ticks_stat.add('auto_spawn_hostile_mobs');
            } else if (!this.givePriorityToSavingFluids &&
                await this.dbActor.saveWorldIfNecessary() // World transaction
            ) {
                this.ticks_stat.add('world_transaction_sync');
            } else {
                // We mustn't save fluids (synchronously) while the world transaction is writing, because it'll cause long waiting.
                if (!this.dbActor.savingWorldNow) {
                    // Save fluids
                    this.db.fluid.saveFluids(); // it's ok to not await it here
                    this.ticks_stat.add('db_fluid_save');
                    this.givePriorityToSavingFluids = false;
                } else {
                    // Ensure that even if the world transaction takes all the time, it'll give at least 1 tick to fluids
                    this.givePriorityToSavingFluids = true;
                }
            }
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

    // onPlayer
    async onPlayer(player: ServerPlayer, skin: PlayerSkin) {
        const timer = new PerformanceTimer();
        const rndToken = Math.random() * 1000000 | 0;
        const user_id = player.session.user_id;
        // 1. Delete previous connections
        const existing_player = this.players.get(user_id);
        if(existing_player) {
            console.log(`OnPlayer delete previous connection for: ${player.session.username}, token=${rndToken}`);
            timer.start('onLeave');
            await this.onLeave(existing_player);
            timer.stop();
            console.log(`finished onLeave, token=${rndToken}`);
        }
        // If thre is a copy of this player player waiting to be saved right now, wait until it's saved and forgotten.
        // It's slow, but safe. TODO restore players without waiting
        const savingPromise = this.players.getDeleted(user_id)?.savingPromise;
        if (savingPromise) {
            console.log(`awaiting savingPromise, token=${rndToken}`);
            timer.start('savingPromise');
            await savingPromise;
            timer.stop();
            console.log(`finished savingPromise, token=${rndToken}`);
        }
        // 2. Insert to DB if new player
        timer.start('registerPlayer');
        console.log(`awaiting registerPlayer, token=${rndToken}`);
        player.init(await this.db.registerPlayer(this, player));
        console.log(`finished registerPlayer, token=${rndToken}`);
        player.skin = skin;
        player.updateHands();
        timer.stop().start('initQuests');
        console.log(`awaiting initQuests, token=${rndToken}`);
        await player.initQuests();
        console.log(`finished initQuests, token=${rndToken}`);
        timer.stop().start('initWaitingDataForSpawn');
        // 3. wait for chunks to load. AFTER THAT other chunks should be loaded
        player.initWaitingDataForSpawn();
        timer.stop();
        // 4. Insert to array
        this.players.list.set(user_id, player);
        // 5. Send about all other players
        const all_players_packets = [];
        for (const p of this.players.values()) {
            if (p.session.user_id != user_id) {
                all_players_packets.push({
                    name: ServerClient.CMD_PLAYER_JOIN,
                    data: p.exportStateUpdate()
                });
            }
        }
        player.sendPackets(all_players_packets);
        // 6. Send to all about new player
        this.sendAll([{
            name: ServerClient.CMD_PLAYER_JOIN,
            data: player.exportStateUpdate()
        }]);
        // 7. Write to chat about new player
        this.chat.sendSystemChatMessageToSelectedPlayers(`player_connected|${player.session.username}`, Array.from(this.players.keys()));
        // 8. Drop item if stored
        if (player.inventory.moveOrDropFromDragSlot()) {
            player.inventory.markDirty();
        }
        // 9. Send CMD_CONNECTED
        const data: PlayerConnectData = {
            session: player.session,
            state: player.state,
            skin: player.skin,
            status: player.status,
            inventory: {
                current: player.inventory.current,
                items: player.inventory.items
            }
        }
        player.sendPackets([{name: ServerClient.CMD_CONNECTED, data}]);
        // 10. Add night vision for building world
        if(this.isBuildingWorld()) {
            player.sendPackets([player.effects.addEffects([{id: Effect.NIGHT_VISION, level: 1, time: 8 * 3600}], true)])
        }
        if (timer.sum > 50) {
            const values = JSON.stringify(timer.round().filter().export())
            this.chat.sendSystemChatMessageToSelectedPlayers('!langTimes in onPlayer(), ms: ' + values, player)
        }
        console.log(`finished onPlayer, token=${rndToken}`);
    }

    // onLeave
    async onLeave(player) {
        if (this.players.exists(player?.session?.user_id)) {
            this.players.delete(player.session.user_id);
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
     * @param {?number[]} except_players  ID of players
     * @return {void}
     */
    sendAll(packets, except_players = null) {
        for (const player of this.players.values()) {
            if (except_players?.includes(player.session.user_id)) {
                continue;
            }
            player.sendPackets(packets);
        }
    }

    /**
     * Отправить только указанным
     * @param {number[] | ServerPlayer} selected_players IDs of players or a single ServerPlayer
     * @param {?number[]} except_players  ID of players.
     *   It's ignored if {@link selected_players} is ServerPlayer.
     * @return {void}
     */
    sendSelected(packets: INetworkMessage[], selected_players: number[] | ServerPlayer, except_players?: number[]) {
        if ((selected_players as ServerPlayer).sendPackets) { // fast check if it's a ServerPlayer
            (selected_players as ServerPlayer).sendPackets(packets)
            return
        }
        for (const user_id of selected_players as number[]) {
            if (except_players?.includes(user_id)) {
                continue;
            }
            const player = this.players.get(user_id);
            player?.sendPackets(packets);
        }
    }

    //
    sendUpdatedInfo() {
        for(const player of this.players.values()) {
            player.sendWorldInfo(true);
        }
    }

    // Create drop items
    createDropItems(player : ServerPlayer | undefined, pos : Vector, items, velocity : Vector, hasPickupDelay?: boolean) {
        try {
            const user_id = hasPickupDelay ? player?.session.user_id : null;
            const drop_item = DropItem.create(this, pos, items, velocity, user_id);
            this.chunks.get(drop_item.chunk_addr)?.addDropItem(drop_item);
            return true;
        } catch (e) {
            player?.sendError(e);
        }
    }

    // Юзер начал видеть этот чанк
    async loadChunkForPlayer(player, addr) {
        const chunk = this.chunks.get(addr);
        // this is an old request for re-sync after player started seeing chunk, in case modifiers are different now
        if (!chunk) {
            // chunk was already unloaded while being in NEARBY array - that's a critical error!
            throw 'Chunk not found';
        }
        chunk.addPlayerLoadRequest(player);
    }

    /**
     * Returns block on world pos, or null.
     * @param {Vector} pos
     * @returns {TBlock}
     */
    getBlock(pos : Vector, resultBlock = null) : TBlock {
        const chunk = this.chunks.getByPos(pos);
        return chunk ? chunk.getBlock(pos, null, null, resultBlock) : null;
    }

    getMaterial(pos : Vector) {
        const chunk = this.chunks.getByPos(pos);
        return chunk ? chunk.getMaterial(pos) : null;
    }

    /**
     * It does everything that needs to be done when a block extra_data is modified:
     * marks the block as dirty, updates the chunk modifiers.
     */
    onBlockExtraDataModified(tblock : TBlock, pos : Vector = tblock.posworld.clone()) {
        const item = tblock.convertToDBItem();
        const data = { pos, item };
        tblock.chunk.dbActor.markBlockDirty(data, tblock.index, BLOCK_DIRTY.UPDATE_EXTRA_DATA);
        tblock.chunk.addModifiedBlock(pos, item, item.id);
    }

    get chunkManager() : ServerChunkManager {
        return this.chunks;
    }

    //
    async applyActions(server_player : ServerPlayer | undefined, actions : WorldAction) {
        const chunks_packets = new VectorCollector();
        const bm = this.block_manager
        //
        const getChunkPackets = (pos : Vector, chunk_addr? : Vector) => {
            if(!chunk_addr) {
                chunk_addr = Vector.toChunkAddr(pos)
            }
            let cps = chunks_packets.get(chunk_addr);
            if (!cps) {
                cps = {
                    chunk: this.chunks.get(chunk_addr),
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
            /* Old code: the argumnt actions.decrement_instrument is unused.
            server_player.inventory.decrement_instrument(actions.decrement_instrument);
            */
            server_player.inventory.decrement_instrument();
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
                if (di.force || server_player && server_player.game_mode.isSurvival()) {
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
                const treeGenerator = await TreeGenerator.getInstance(this.info.seed);
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
            try {
                const block_pos_in_chunk = new Vector(Infinity, Infinity, Infinity);
                const chunk_addr = new Vector(0, 0, 0);
                const prev_chunk_addr = new Vector(Infinity, Infinity, Infinity);
                let chunk = null;
                let postponedActions = null; // WorldAction containing a subset of actions.blocks, postponed until the current chunk loads
                const previous_item = {id: 0}
                let cps = null;
                for (let params of actions.blocks.list) {
                    const block_pos = new Vector(params.pos).flooredSelf();
                    params.pos = block_pos;
                    //
                    if(!(params.item instanceof DBItemBlock)) {
                        // if(!globalThis.asdfasdf) globalThis.asdfasdf = 0
                        // if(globalThis.asdfasdf++ % 1000 == 0) console.log(globalThis.asdfasdf)
                        params.item = this.block_manager.convertBlockToDBItem(params.item)
                    }
                    //
                    Vector.toChunkAddr(params.pos, chunk_addr);
                    if (!prev_chunk_addr.equal(chunk_addr)) {
                        cps = getChunkPackets(null, chunk_addr);
                        chunk?.light?.flushDelta();
                        chunk = this.chunks.getOrRestore(chunk_addr);
                        postponedActions = null; // the new chunk must create its own postponedActions
                        prev_chunk_addr.copyFrom(chunk_addr);
                    }
                    const isReady = chunk && chunk.isReady();
                    // 2. Mark as became modifieds
                    this.worldChunkFlags.add(chunk_addr, WorldChunkFlags.MODIFIED_BLOCKS);
                    // 3.
                    if (isReady) {
                        let sanitizedParams = params;
                        const sanitizedItem = shallowCloneAndSanitizeIfPrivate(params.item);
                        if (sanitizedItem) {
                            // I'm not sure if params are used anywhere else, so shallow clone them to be safe.
                            sanitizedParams = {...params};
                            sanitizedParams.item = sanitizedItem;
                        }
                        block_pos_in_chunk.copyFrom(block_pos).subSelf(chunk.coord)
                        cps.packets.push({
                            name: ServerClient.CMD_BLOCK_SET,
                            data: sanitizedParams
                        });
                        // 0. Play particle animation on clients
                        if (!ignore_check_air) {
                            if (params.action_id == ServerClient.BLOCK_ACTION_DESTROY) {
                                if (params.destroy_block.id > 0) {
                                    const except_players = [];
                                    if(server_player) except_players.push(server_player)
                                    cps.custom_packets.push({
                                        except_players,
                                        packets: [{
                                            name: ServerClient.CMD_PARTICLE_BLOCK_DESTROY,
                                            data: {
                                                pos: params.pos.add(new Vector(.5, .5, .5)),
                                                item: params.destroy_block
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
                                    const newMaterial = bm.BLOCK_BY_ID[params.item.id];
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
                        chunk.addModifiedBlock(block_pos, params.item, oldId);
                        // Mark the block as dirty and remember the change to be saved to DB
                        chunk.dbActor.markBlockDirty(params, tblock.index);

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
                                    const oldMaterial = bm.BLOCK_BY_ID[oldId];
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
                                    data: { pos: params.pos, block: params.destroy_block }
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
                        if (chunk) {
                            // The chunk exists, but not ready yet. Queue the block action until the chunk is loaded.
                            postponedActions = postponedActions ?? chunk.getOrCreatePendingAction(server_player, actions)
                            postponedActions.addBlock(params);
                        } else {
                            this.dbActor.addChunklessBlockChange(chunk_addr, params);
                        }
                    }
                }
                chunk?.light?.flushDelta();
            } catch(e) {
                console.error('error', e);
                throw e;
            }
            this.addUpdatedBlocksActions(this.updatedBlocksByListeners);
        }
        if (actions.fluids.length > 0) {
            if (actions.fluidFlush) {
                // TODO: for schemas - make separate action after everything!
                await this.db.fluid.flushWorldFluidsList(actions.fluids);
                // assume same chunk for all cells
            } else {
                this.chunks.fluidWorld.applyWorldFluidsList(actions.fluids);
            }
        }
        // Play sound
        if (actions.play_sound) {
            for(let params of actions.play_sound) {
                let cps = null
                try {
                    cps = getChunkPackets(params.pos);
                } catch(e) {
                    console.error(e)
                    console.error(actions)
                }
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
                inventory.refresh(true)
            }
        }
        //
        for (let cp of chunks_packets) {
            if (cp.chunk && cp.packets.length > 0 || cp.custom_packets.length > 0) {
                // send 1
                if(cp.packets.length > 0) {
                    cp.chunk.sendAll(cp.packets, []);
                }
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
        // Sleep
        if(actions.sleep) {
            server_player.state.sleep = actions.sleep
            server_player.state.sitting = false
            server_player.state.lies = false
            server_player.state.pos = actions.sleep.pos
            server_player.sendNearPlayers()
        }
        // Spawn mobs
        if(actions.mobs.spawn.length > 0) {
            for(let i = 0; i < actions.mobs.spawn.length; i++) {
                const params = actions.mobs.spawn[i];
                this.mobs.create(params);
            }
        }
        // Activate mobs
        // мало кода, но работает медленнее ;)
        // actions.mobs.activate.map((_, v) => await this.mobs.activate(v.entity_id, v.spawn_pos, v.rotate));
        for(const params of actions.mobs.activate) {
            await this.mobs.activate(params.entity_id, params.spawn_pos, params.rotate);
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
    getPlayersNear(pos, max_distance, not_in_creative : boolean = false, in_spectator : boolean = false) {
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
                if(player.status !== PLAYER_STATUS.ALIVE) {
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
                for(const ticking_block of chunk.ticking_blocks.blocks.values()) {
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

    getTime() {
        const time = this.info.calendar.day_time
        const age = this.info.calendar.age
        const hours = time / 1000 | 0
        const minutes = (time - hours * 1000) / 1000 * 60 | 0
        const minutes_string = minutes.toFixed(0).padStart(2, '0')
        const hours_string   = hours.toFixed(0).padStart(2, '0')
        const time_visible = time

        return {
            time:           time, // max value is 24_000
            time_visible:   time_visible,
            day:            age,
            hours:          hours,
            minutes:        minutes,
            string:         hours_string + ':' + minutes_string
        }
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