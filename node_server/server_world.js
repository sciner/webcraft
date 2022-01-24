import {Mob} from "./mob.js";
import {DropItem} from "./drop_item.js";
import {ServerChat} from "./server_chat.js";
import {ChestManager} from "./chest_manager.js";
import {WorldAdminManager} from "./admin_manager.js";
import {ModelManager} from "./model_manager.js";

import {Vector, VectorCollector} from "../www/js/helpers.js";
import {ServerClient} from "../www/js/server_client.js";
import {getChunkAddr, ALLOW_NEGATIVE_Y} from "../www/js/chunk.js";
import {BLOCK} from "../www/js/blocks.js";
import {doBlockAction} from "../www/js/block_action.js";

import {ServerChunkManager} from "./server_chunk_manager.js";
import config from "./config.js";

export const MAX_BLOCK_PLACE_DIST = 14;

// for debugging client time offset
export const SERVE_TIME_LAG = config.Debug ? (0.5 - Math.random()) * 50000 : 0;

export class ServerWorld {

    constructor() {}
    temp_vec = new Vector();

    get serverTime() {
        return Date.now() + SERVE_TIME_LAG;
    }

    async initServer(world_guid, db) {
        if (SERVE_TIME_LAG) {
            console.log('[World] Server time lag ', SERVE_TIME_LAG);
        }
        const that          = this;
        this.db             = db;
        this.info           = await this.db.getWorld(world_guid);
        this.chests         = new ChestManager(this);
        this.chat           = new ServerChat(this);
        this.chunks         = new ServerChunkManager(this);
        this.players        = new Map(); // new PlayerManager(this);
        this.mobs           = new Map(); // Store refs to all loaded mobs in the world
        this.all_drop_items = new Map(); // Store refs to all loaded drop items in the world
        this.models         = new ModelManager();
        this.models.init();
        this.ticks_stat     = {
            pn: null,
            last: 0,
            total: 0,
            count: 0,
            min: Number.MAX_SAFE_INTEGER,
            max: 0,
            values: {
                chunks: {min: Infinity, max: -Infinity, avg: 0, sum: 0},
                players: {min: Infinity, max: -Infinity, avg: 0, sum: 0},
                mobs: {min: Infinity, max: -Infinity, avg: 0, sum: 0},
                drop_items: {min: Infinity, max: -Infinity, avg: 0, sum: 0},
                pickat_action_queue: {min: Infinity, max: -Infinity, avg: 0, sum: 0},
            },
            start() {
                this.pn = performance.now();
                this.pn_values = performance.now();
            },
            add(field) {
                const value = this.values[field];
                if(value) {
                    const elapsed = performance.now() - this.pn_values;
                    value.sum += elapsed;
                    if(elapsed < value.min) value.min = elapsed;
                    if(elapsed > value.max) value.max = elapsed;
                    value.avg = value.sum / this.count;
                } else {
                    console.error('invalid tick stat value: ' + field);
                }
                this.pn_values = performance.now();
            },
            end() {
                if(this.pn !== null) {
                    // Calculate stats of elapsed time for ticks
                    this.last = performance.now() - this.pn;
                    this.total += this.last;
                    this.count++;
                    if(this.last < this.min) this.min = this.last;
                    if(this.last > this.max) this.max = this.last;
                }
            }
        };
        //
        this.admins = new WorldAdminManager(this);
        await this.admins.load();
        //
        await this.restoreModifiedChunks();
        await this.chunks.initWorker();
        //
        this.tickerWorldTimer = setInterval(() => {
            this.tick();
        }, 50);
        //
        this.saveWorldTimer = setInterval(() => {
            // let pn = performance.now();
            this.save();
            // calc time elapsed
            // console.log("Save took %sms", Math.round((performance.now() - pn) * 1000) / 1000);
        }, 5000);
        // Queue of player pickat actions
        this.pickat_action_queue = {
            list: [],
            add: function(player, params) {
                this.list.push({player, params});
            },
            run: async function() {
                while(this.list.length > 0) {
                    const world = that;
                    const queue_item = this.list.shift();
                    const server_player = queue_item.player;
                    const params = queue_item.params;
                    const currentInventoryItem = server_player.inventory.current_item;
                    const player = {
                        radius:     0.7,
                        height:     server_player.height,
                        pos:        new Vector(server_player.state.pos),
                        rotate:     server_player.rotateDegree.clone()
                    };
                    const actions = await doBlockAction(params, world, player, currentInventoryItem);
                    // @todo Need to compare two actions
                    // console.log(JSON.stringify(params.actions.blocks));
                    // console.log(JSON.stringify(actions.blocks));
                    await world.applyActions(server_player, actions);
                }
            }
        };
    }

    // World tick
    async tick() {
        let delta = 0;
        if(this.pn) {
            delta = (performance.now() - this.pn) / 1000;
        }
        this.pn = performance.now();
        //
        this.ticks_stat.start();
        // 1.
        this.chunks.tick(delta);
        this.ticks_stat.add('chunks');
        // 2.
        for(let player of this.players.values()) {
            player.tick(delta);
        }
        this.ticks_stat.add('players');
        // 3.
        for(let [entity_id, mob] of this.mobs) {
            mob.tick(delta);
        }
        this.ticks_stat.add('mobs');
        // 4.
        for(let [entity_id, drop_item] of this.all_drop_items) {
            drop_item.tick(delta);
        }
        this.ticks_stat.add('drop_items');
        // 5.
        this.pickat_action_queue.run();
        this.ticks_stat.add('pickat_action_queue');
        //
        this.ticks_stat.end();
    }

    save() {
        for(let player of this.players.values()) {
            this.db.savePlayerState(player);
        }
    }

    // onPlayer
    async onPlayer(player, skin) {
        // 1. Insert to DB if new player
        player.init(await this.db.registerUser(this, player));
        player.state.skin = skin;
        player.updateHands();
        // 2. Add new connection
        if (this.players.has(player.session.user_id)) {
            console.log('OnPlayer delete previous connection for: ' + player.session.username);
            this.onLeave(this.players.get(player.session.user_id));
        }
        // 3. Insert to array
        this.players.set(player.session.user_id, player);
        // 4. Send about all other players
        let all_players_packets = [];
        for(let c of this.players.values()) {
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
        this.chat.sendSystemChatMessageToSelectedPlayers(player.session.username + ' подключился', this.players.keys());
        // 7. Send CMD_CONNECTED
        player.sendPackets([{name: ServerClient.CMD_CONNECTED, data: {
            session: player.session,
            state: player.state,
            inventory: {
                current: player.inventory.current,
                items: player.inventory.items
            }
        }}]);
        // 8. Check player visible chunks
        this.chunks.checkPlayerVisibleChunks(player, true);
    }

    // onLeave
    async onLeave(player) {
        if(this.players.has(player?.session?.user_id)) {
            this.players.delete(player.session.user_id);
            this.db.savePlayerState(player);
            player.onLeave();
            // Notify other players about leave me
            let packets = [{
                name: ServerClient.CMD_PLAYER_LEAVE,
                data: {
                    id: player.session.user_id
                }
            }];
            this.sendAll(packets, [player.session.user_id]);
        }
    }

    /**
     * Возвращает игровое время
     * @return {Object}
     */
    getTime() {
        if(!this.world_state) {
            return null;
        }
        let add = (performance.now() - this.dt_connected) / 1000 / 1200 * 24000 | 0;
        let time = (this.world_state.day_time + 6000 + add) % 24000 | 0;
        let hours = time / 1000 | 0;
        let minutes = (time - hours * 1000) / 1000 * 60 | 0;
        let minutes_string = minutes > 9 ? minutes : '0' + minutes;
        let hours_string = hours > 9 ? hours : '0' + hours;
        return {
            day:        this.world_state.age,
            hours:      hours,
            minutes:    minutes,
            string:     hours_string + ':' + minutes_string
        };
    }

    /**
     * Send commands for all except player id list
     * @param {Object[]} packets
     * @param {number[]} except_players  ID of players
     * @return {void}
     */
    sendAll(packets, except_players) {
        for(let player of this.players.values()) {
            if(except_players && except_players.indexOf(player.session.user_id) >= 0) {
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
            if(except_players && except_players.indexOf(user_id) >= 0) {
                continue;
            }
            let player = this.players.get(user_id);
            if(player) {
                player.sendPackets(packets);
            }
        }
    }

    /**
     * Teleport player
     * @param {ServerPlayer} player 
     * @param {Object} params 
     * @return {void}
     */
    teleportPlayer(player, params) {
        var new_pos = null;
        if (params.pos) {
            new_pos = params.pos;
        } else if (params.place_id) {
            switch (params.place_id) {
                case 'spawn': {
                    new_pos = player.state.pos_spawn;
                    break;
                }
                case 'random': {
                    new_pos = new Vector(
                        (Math.random() * 2000000 - Math.random() * 2000000) | 0,
                        120,
                        (Math.random() * 2000000 - Math.random() * 2000000) | 0
                    );
                    break;
                }
            }
        }
        if (new_pos) {
            let packets = [{
                name: ServerClient.CMD_TELEPORT,
                data: {
                    pos:        new_pos,
                    place_id:   params.place_id
                }
            }];
            this.sendSelected(packets, [player.session.user_id], []);
            player.state.pos = new_pos;
            this.chunks.checkPlayerVisibleChunks(player, true);
        }
    }

    // changePlayerPosition...
    changePlayerPosition(player, params) {
        // @todo Нужно разрешить в режиме спектатора посещать отрицательную высоту,
        // но если это сделать, то почему-то игрок зависает в точке контакта и после
        // этого никуда не может сместиться =(
        if (!ALLOW_NEGATIVE_Y && params.pos.y < 0) {
            this.teleportPlayer(player, {
                place_id: 'spawn'
            })
            return;
        }
        player.state.pos                = new Vector(params.pos);
        player.state.rotate             = new Vector(params.rotate);
        player.position_changed         = true;
    }

    // Spawn new mob
    async spawnMob(player, params) {
        try {
            if(!this.admins.checkIsAdmin(player)) {
                throw 'error_not_permitted';
            }
            await this.createMob(params);
            // let mob = await Mob.create(this, params);
            // this.chunks.get(mob.chunk_addr)?.addMob(mob);
            return true;
        } catch(e) {
            console.log('e', e);
            let packets = [{
                name: ServerClient.CMD_ERROR,
                data: {
                    message: e
                }
            }];
            this.sendSelected(packets, [player.session.user_id], []);
        }
    }

    // Create mob
    async createMob(params) {
        let chunk_addr = getChunkAddr(params.pos);
        let chunk = this.chunks.get(chunk_addr);
        if(chunk) {
            let mob = await Mob.create(this, params);
            chunk.addMob(mob);
            return mob;
        } else {
            console.error('Chunk for mob not found');
        }
        return null;
    }

    // Create drop items
    async createDropItems(player, pos, items, velocity) {
        try {
            let drop_item = await DropItem.create(this, player, pos, items, velocity);
            this.chunks.get(drop_item.chunk_addr)?.addDropItem(drop_item);
            return true;
        } catch(e) {
            console.log('e', e);
            let packets = [{
                name: ServerClient.CMD_ERROR,
                data: {
                    message: e
                }
            }];
            this.sendSelected(packets, [player.session.user_id], []);
        }
    }

    /**
     * Restore modified chunks list
     * @return {boolean}
     */
    async restoreModifiedChunks() {
        this.chunkModifieds = new VectorCollector();
        let list = await this.db.chunkBecameModified();
        for(let addr of list) {
            this.chunkBecameModified(addr);
        }
        return true;
    }

    // Chunk has modifiers
    chunkHasModifiers(addr) {
        return this.chunkModifieds.has(addr);
    }
    
    // Add chunk to modified
    chunkBecameModified(addr) {
        if(this.chunkModifieds.has(addr)) {
            return false;
        }
        return this.chunkModifieds.set(addr, addr);
    }

    // Юзер начал видеть этот чанк
    async loadChunkForPlayer(player, addr) {
        let chunk = this.chunks.get(addr);
        if(!chunk) {
            throw 'Chunk not found';
        }
        chunk.addPlayerLoadRequest(player);
    }

    getBlock(pos) {
        let chunk_addr = getChunkAddr(pos);
        let chunk = this.chunks.get(chunk_addr);
        if(!chunk) {
            return null;
        }
        return chunk.getBlock(pos);
    }

    // Create entity
    async createEntity(player, params) {
        // @ParamBlockSet
        let addr = getChunkAddr(params.pos);
        let chunk = this.chunks.get(addr);
        if(chunk) {
            await chunk.doBlockAction(player, params, false, false, true);
            await this.db.blockSet(this, player, params);
            this.chunkBecameModified(addr);
        } else {
            console.log('createEntity: Chunk not found', addr);
        }
    }

    /**
     * @return {ServerChunkManager}
     */
    get chunkManager() {
        return this.chunks;
    }

    /*
    //
    async setBlock(player, params) {
        // @ParamBlockSet
        // Ignore bedrock for non admin
        let is_admin = this.admins.checkIsAdmin(player);
        if (params.item.id != 1 || is_admin) {
            let dist = player.state.pos.distance(params.pos);
            if(dist > MAX_BLOCK_PLACE_DIST) {
                console.log('dist', dist);
                throw 'error_unreachable_coordinate';
            }
            this.pickat_action_queue.add(player, params);
            this.pickat_action_queue.run();
        }
    }*/

    pickAtAction(server_player, params) {
        this.pickat_action_queue.add(server_player, params);
    }

    // setBlocksApply
    // @example:
    // [
    //      {
    //          "pos": {"x": 0, "y": 0, "z": 0},
    //          "item": {"id": 2}
    //      }
    // ]
    async applyActions(server_player, actions) {
        let chunks_packets = new VectorCollector();
        //
        const getChunkPackets = (pos) => {
            let chunk_addr = getChunkAddr(pos);
            let chunk = this.chunks.get(chunk_addr);
            //if(!chunk) {
            //    return null;
            //}
            let cps = chunks_packets.get(chunk_addr);
            if(!cps) {
                cps = {packets: [], chunk: chunk};
                chunks_packets.set(chunk_addr, cps);
            }
            return cps;
        };
        // Send message to chat
        if(actions.chat_message) {
            this.chat.sendMessage(server_player, actions.chat_message);
        }
        // Create chest
        if(actions.create_chest) {
            const params = actions.create_chest;
            const chest = await this.chests.create(server_player, params);
            const new_item = chest.item;
            const b_params = {pos: params.pos, item: new_item, action_id: ServerClient.BLOCK_ACTION_CREATE};
            actions.blocks.list.push(b_params);
        }
        // Delete chest
        if(actions.delete_chest) {
            const params = actions.delete_chest;
            await this.chests.delete(params.entity_id, params.pos);
        }
        // Decrement item
        if(actions.decrement) {
            server_player.inventory.decrement(actions.decrement);
        }
        // Create painting
        if(actions.create_painting) {
            const params = actions.create_painting;
            const pos = new Vector(params.aabb[0], params.aabb[1], params.aabb[2]).floored();
            await this.db.createPainting(this, server_player, pos, params);
            const cps = getChunkPackets(pos);
            if(cps) {
                if(!cps.chunk) {
                    throw 'error_chunk_not_loaded';
                }
                cps.chunk.addPaintings([params], false);
                cps.packets.push({
                    name: ServerClient.CMD_CREATE_PAINTING,
                    data: [params]
                });
            }
        }
        // Create drop items
        if(actions.drop_items && actions.drop_items.length > 0) {
            if(server_player.game_mode.isSurvival()) {
                for(let di of actions.drop_items) {
                    // Add velocity for drop item
                    this.temp_vec.set(
                        0,
                        .5,
                        0,
                    );
                    this.createDropItems(server_player, di.pos, di.items, this.temp_vec);
                }
            }
        }
        // Modify blocks
        if(actions.blocks && actions.blocks.list) {
            let chunk_addr = new Vector(0, 0, 0);
            let prev_chunk_addr = new Vector(Infinity, Infinity, Infinity);
            let chunk = null;
            const ignore_check_air = (actions.blocks.options && 'ignore_check_air' in actions.blocks.options) ? !!actions.blocks.options.ignore_check_air : false;
            const on_block_set = actions.blocks.options && 'on_block_set' in actions.blocks.options ? !!actions.blocks.options.on_block_set : true;
            await this.db.TransactionBegin();
            try {
                for(let params of actions.blocks.list) {
                    params.item = BLOCK.convertItemToInventoryItem(params.item);
                    chunk_addr = getChunkAddr(params.pos, chunk_addr);
                    if(!prev_chunk_addr.equal(chunk_addr)) {
                        chunk = this.chunks.get(chunk_addr);
                        prev_chunk_addr.set(chunk_addr.x, chunk_addr.y, chunk_addr.z);
                    }
                    await this.db.blockSet(this, null, params);
                    if(chunk) {
                        const block_pos = new Vector(params.pos).floored();
                        const block_pos_in_chunk = block_pos.sub(chunk.coord);
                        const cps = getChunkPackets(params.pos);
                        cps.packets.push({
                            name: ServerClient.CMD_BLOCK_SET,
                            data: params
                        });
                        // 0. Play particle animation on clients
                        if(!ignore_check_air) {
                            if(params.item.id == BLOCK.AIR.id) {
                                let tblock = chunk.tblocks.get(block_pos_in_chunk);
                                if(tblock.id > 0) {
                                    let destroy_data = {
                                        pos: params.pos,
                                        item: {id: tblock.id}
                                    }
                                    let packet = {
                                        name: ServerClient.CMD_PARTICLE_BLOCK_DESTROY,
                                        data: destroy_data
                                    };
                                    cps.packets.push(packet);
                                }
                            }
                        }
                        // 2. Mark as became modifieds
                        this.chunkBecameModified(chunk_addr);
                        // 3. Store in chunk tblocks
                        chunk.tblocks.delete(block_pos_in_chunk);
                        let tblock           = chunk.tblocks.get(block_pos_in_chunk);
                        tblock.id            = params.item.id;
                        tblock.extra_data    = params.item?.extra_data || null;
                        tblock.entity_id     = params.item?.entity_id || null;
                        tblock.power         = params.item?.power || null;
                        tblock.rotate        = params.item?.rotate || null;
                        // 1. Store in modify list
                        chunk.modify_list.set(block_pos.toHash(), params.item);
                        if(on_block_set) {
                            chunk.onBlockSet(block_pos.clone(), params.item)
                        }
                    } else {
                        console.error('Chunk not found in pos', chunk_addr, params);
                    }
                }
                await this.db.TransactionCommit();
            } catch(e) {
                await this.db.TransactionRollback();
                throw e;
            }
        }
        for(let cp of chunks_packets) {
            if(cp.chunk) {
                cp.chunk.sendAll(cp.packets, []);
            }
        }
    }

}