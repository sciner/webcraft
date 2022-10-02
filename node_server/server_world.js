import config from "./config.js";

import { Brains } from "./fsm/index.js";
import { DropItem } from "./drop_item.js";
import { ServerChat } from "./server_chat.js";
import { ModelManager } from "./model_manager.js";
import { PlayerEvent } from "./player_event.js";
import { QuestManager } from "./quest/manager.js";

import { WorldTickStat } from "./world/tick_stat.js";
import { WorldPacketQueue } from "./world/packet_queue.js";
import { WorldActionQueue } from "./world/action_queue.js";
import { WorldMobManager } from "./world/mob_manager.js";
import { WorldAdminManager } from "./world/admin_manager.js";
import { WorldChestManager } from "./world/chest_manager.js";

import { getChunkAddr, Vector, VectorCollector } from "../www/js/helpers.js";
import { AABB } from "../www/js/core/AABB.js";
import { ServerClient } from "../www/js/server_client.js";
import { ServerChunkManager } from "./server_chunk_manager.js";
import { PacketReader } from "./network/packet_reader.js";
import { GAME_DAY_SECONDS, GAME_ONE_SECOND, INVENTORY_DRAG_SLOT_INDEX, INVENTORY_VISIBLE_SLOT_COUNT } from "../www/js/constant.js";
import { Weather } from "../www/js/type.js";
import { TreeGenerator } from "./world/tree_generator.js";

// for debugging client time offset
export const SERVE_TIME_LAG = config.Debug ? (0.5 - Math.random()) * 50000 : 0;

export class ServerWorld {

    constructor(block_manager) {
        this.temp_vec = new Vector();
        this.block_manager = block_manager;
    }

    async initServer(world_guid, db_world) {
        if (SERVE_TIME_LAG) {
            console.log('[World] Server time lag ', SERVE_TIME_LAG);
        }
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
        // Brains
        this.brains = new Brains();
        for(let fn of config.brains) {
            await import(`./fsm/brain/${fn}.js`).then((module) => {
                this.brains.add(fn, module.Brain);
            });
        }
        //
        this.db             = db_world;
        this.db.removeDeadDrops();
        this.info           = await this.db.getWorld(world_guid);
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
        //
        this.players        = new Map(); // new PlayerManager(this);
        this.all_drop_items = new Map(); // Store refs to all loaded drop items in the world
        //
        await this.models.init();
        await this.quests.init();
        await this.admins.load();
        await this.restoreModifiedChunks();
        await this.db.fluid.restoreFluidChunks();
        await this.chunks.initWorker();
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

    get serverTime() {
        return Date.now() + SERVE_TIME_LAG;
    }

    // Return world info
    getInfo() {
        return this.info;
    }

    // Update world calendar
    updateWorldCalendar() {
        if(!this.info.calendar) {
            this.info.calendar = {
                age: null,
                day_time: null,
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
            for (let player of this.players.values()) {
                await player.tick(delta, this.ticks_stat.number);
            }
            this.ticks_stat.add('players');
            // 4.
            for (let [_, drop_item] of this.all_drop_items) {
                drop_item.tick(delta);
            }
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
            //
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
        for(let player of this.players.values()) {
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
        // 3. Insert to array
        this.players.set(player.session.user_id, player);
        // 4. Send about all other players
        const all_players_packets = [];
        for (let c of this.players.values()) {
            if (c.session.user_id != player.session.user_id) {
                all_players_packets.push({
                    name: ServerClient.CMD_PLAYER_JOIN,
                    data: c.exportState()
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
        const drag_item = player.inventory.items[INVENTORY_DRAG_SLOT_INDEX];
        if(drag_item) {
            let saved = false;
            for(let i = 0; i < INVENTORY_VISIBLE_SLOT_COUNT; i++) {
                if(!player.inventory.items[i]) {
                    player.inventory.items[i] = drag_item;
                    player.inventory.items[INVENTORY_DRAG_SLOT_INDEX] = null;
                    await player.inventory.save();
                    saved = true;
                    break;
                }
            }
            if(!saved) {
                player.inventory.dropFromDragSlot();
            }
        }
        // 8. Send CMD_CONNECTED
        player.sendPackets([{
            name: ServerClient.CMD_CONNECTED, data: {
                session: player.session,
                state: player.state,
                inventory: {
                    current: player.inventory.current,
                    items: player.inventory.items
                }
            }
        }]);
        // 8. Check player visible chunks
        this.chunks.checkPlayerVisibleChunks(player, true);
    }

    // onLeave
    async onLeave(player) {
        if (this.players.has(player?.session?.user_id)) {
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
        for (let player of this.players.values()) {
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
        for(let p of this.players.values()) {
            p.sendWorldInfo(true);
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

    getBlock(pos) {
        const chunk_addr = getChunkAddr(pos);
        const chunk = this.chunks.get(chunk_addr);
        if (!chunk) {
            return null;
        }
        return chunk.getBlock(pos);
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
                    ).normalize().multiplyScalar(0.375);
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
        if (actions.blocks && actions.blocks.list) {
            let chunk_addr = new Vector(0, 0, 0);
            let prev_chunk_addr = new Vector(Infinity, Infinity, Infinity);
            let chunk = null;
            // trick for worldedit plugin
            const ignore_check_air = (actions.blocks.options && 'ignore_check_air' in actions.blocks.options) ? !!actions.blocks.options.ignore_check_air : false;
            const on_block_set = actions.blocks.options && 'on_block_set' in actions.blocks.options ? !!actions.blocks.options.on_block_set : true;
            const use_tx = actions.blocks.list.length > 1;
            if (use_tx) {
                await this.db.TransactionBegin();
            }
            try {
                let pm = performance.now();
                const modified_chunks = new VectorCollector();
                let all = [];
                const create_block_list = [];
                for (let params of actions.blocks.list) {
                    params.item = this.block_manager.convertItemToDBItem(params.item);
                    chunk_addr = getChunkAddr(params.pos, chunk_addr);
                    if (!prev_chunk_addr.equal(chunk_addr)) {
                        modified_chunks.set(chunk_addr.clone(), true);
                        chunk = this.chunks.get(chunk_addr);
                        prev_chunk_addr.set(chunk_addr.x, chunk_addr.y, chunk_addr.z);
                    }
                    // await this.db.blockSet(this, server_player, params);
                    if(params.action_id == ServerClient.BLOCK_ACTION_CREATE) {
                        create_block_list.push(params);
                    } else {
                        all.push(this.db.blockSet(this, server_player, params));
                    }
                    // 2. Mark as became modifieds
                    this.chunkBecameModified(chunk_addr);
                    if (chunk && chunk.tblocks) {
                        const block_pos = new Vector(params.pos).floored();
                        const block_pos_in_chunk = block_pos.sub(chunk.coord);
                        const cps = getChunkPackets(params.pos);
                        cps.packets.push({
                            name: ServerClient.CMD_BLOCK_SET,
                            data: params
                        });
                        // 0. Play particle animation on clients
                        if (!ignore_check_air && server_player) {
                            if (params.action_id == ServerClient.BLOCK_ACTION_DESTROY) {
                                if (params.destroy_block_id > 0) {
                                    cps.custom_packets.push({
                                        except_players: [server_player.session.user_id],
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
                        // 3. Store in chunk tblocks
                        chunk.tblocks.delete(block_pos_in_chunk);
                        let tblock = chunk.tblocks.get(block_pos_in_chunk);
                        tblock.id = params.item.id;
                        tblock.extra_data = params.item?.extra_data || null;
                        tblock.entity_id = params.item?.entity_id || null;
                        tblock.power = params.item?.power || null;
                        tblock.rotate = params.item?.rotate || null;
                        // 1. Store in modify list
                        chunk.addModifiedBlock(block_pos, params.item);
                        if (on_block_set) {
                            chunk.onBlockSet(block_pos.clone(), params.item)
                        }
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
                        // console.error('Chunk not found in pos', chunk_addr, params);
                    }
                }
                if(create_block_list.length > 0) {
                    all.push(this.db.blockSetBulk(this, server_player, create_block_list));
                }
                await Promise.all(all);
                await this.db.updateChunks(Array.from(modified_chunks.keys()));
                if (use_tx) {
                    await this.db.TransactionCommit();
                }
                // console.log(performance.now() - pm);
            } catch (e) {
                console.log('error', e);
                if (use_tx) {
                    await this.db.TransactionRollback();
                }
                throw e;
            }
        }
        if (actions.fluids.length > 0) {
            let chunks = this.chunkManager.fluidWorld.applyWorldFluidsList(actions.fluids);
            for (let chunk of chunks) {
                chunk.sendFluid(chunk.fluid.saveDbBuffer());
                chunk.fluid.markDirtyDatabase();
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
                if(player.is_dead) {
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

    // Return game rule
    getGameRule(rule_code) {
        switch(rule_code) {
            case 'doDaylightCycle': {
                return this.info.rules[rule_code] || true;
                break;
            }
            case 'randomTickSpeed': {
                return this.info.rules[rule_code] || 3;
                break;
            }
            default: {
                throw 'error_incorrect_rule_code';
            }
        }
    }


    // Set world game rule value
    async setGameRule(rule_code, value) {
        //
        function parseBoolValue(value) {
            value = value.toLowerCase().trim();
            if(['true', 'false'].indexOf(value) < 0) {
                throw 'error_invalid_value_type';
            }
            return value == 'true';
        }
        //
        function parseIntValue(value) {
            value = parseInt(value);
            if (isNaN(value) || !isFinite(value)) {
                throw 'error_invalid_value_type';
            }
            return value;
        }
        //
        const rules = this.info.rules;
        //
        switch(rule_code) {
            case 'doDaylightCycle': {
                // /gamerule doDaylightCycle false|true
                value = parseBoolValue(value);
                if(value) {
                    delete(rules.doDaylightCycleTime);
                } else {
                    // fix current day_time
                    this.updateWorldCalendar();
                    rules.doDaylightCycleTime = this.info.calendar.day_time;
                }
                break;
            }
            case 'randomTickSpeed': {
                value = parseIntValue(value);
                break;
            }
            default: {
                throw 'error_incorrect_rule_code';
            }
        }
        // Apply changes if not equal with current
        if(rules[rule_code] == value) {
            return false;
        }
        rules[rule_code] = value;
        // Save to DB and send to players
        await this.db.saveGameRules(this.info.guid, this.info.rules);
        this.sendUpdatedInfo();
        this.chat.sendSystemChatMessageToSelectedPlayers(`Game rule '${rule_code}' changed to '${value}'`, this.players.keys());
        return true;
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
        return this.weather?.name != 'clear';
    }

    // Возвращает уровень освещности в мире
    getLight() {
        const time = this.info.calendar.day_time;
        if (this.isRaining()) {
            return 12;
        }
        if (time < 6000 || time > 18000) {
            return 4;
        }
        return 15;
    }

}