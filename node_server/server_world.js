import uuid from 'uuid';

import {Mob} from "./mob.js";
import {ServerChat} from "./server_chat.js";
import {ServerChunk} from "./server_chunk.js";
import {EntityManager} from "./entity_manager.js";
import {WorldAdminManager} from "./admin_manager.js";
import {ModelManager} from "./model_manager.js";

import {Vector} from "../www/js/helpers.js";
import {GameMode} from "../www/js/game_mode.js";
import {Physics} from "../www/js/physics.js";
import {ChunkManager} from "../www/js/chunk_manager.js";
import {PlayerManager} from "../www/js/player_manager.js";
import {ServerClient} from "../www/js/server_client.js";
import {getChunkAddr} from "../www/js/chunk.js";

export class ServerWorld {

    constructor() {
    }

    async initServer(world_guid, db) {
        this.db         = db;
        this.info       = await this.db.getWorld(world_guid);
        this.entities   = new EntityManager(this);
        this.chat       = new ServerChat(this);
        this.chunks     = new Map();
        this.players    = new Map(); // new PlayerManager(this);
        //
        this.models     = new ModelManager();
        this.models.init();
        //
        this.admins = new WorldAdminManager(this);
        await this.admins.load();
        //
        this.restoreModifiedChunks();
        //
        this.tickerWorldTimer = setInterval(() => {
            // let pn = performance.now();
            this.tick();
            // time elapsed forcurrent tick
            // console.log("Tick took %sms", Math.round((performance.now() - pn) * 1000) / 1000);
        }, 50);
        //
        this.saveWorldTimer = setInterval(() => {
            // let pn = performance.now();
            this.save();
            // calc time elapsed
            // console.log("Save took %sms", Math.round((performance.now() - pn) * 1000) / 1000);
        }, 5000);
    }

    tick() {}

    save() {
        for(let player of this.players.values()) {
            this.db.savePlayerState(player);
        }
    }

    // onPlayer
    async onPlayer(player, skin) {
        // 1. Insert to DB if new player
        player.state = await this.db.registerUser(this, player);
        player.state.skin = skin;
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
                let params = {
                    id:       c.session.user_id,
                    username: c.session.username,
                    pos:      c.state.pos,
                    rotate:   c.state.rotate,
                    skin:     c.state.skin
                }
                all_players_packets.push({
                    name: ServerClient.CMD_PLAYER_JOIN,
                    data: params
                });
            }
        }
        player.sendPackets(all_players_packets);
        // 5. Send to all about new players
        this.sendAll([{
            name: ServerClient.CMD_PLAYER_JOIN,
            data: {
                id:       player.session.user_id,
                username: player.session.username,
                pos:      player.state.pos,
                rotate:   player.state.rotate,
                skin:     player.state.skin
            }
        }], []);
        // 6. Write to chat about new player
        this.chat.sendSystemChatMessageToSelectedPlayers(player.session.username + ' подключился', this.players.keys());
        // 7. Send CMD_CONNECTED
        player.sendPackets([{name: ServerClient.CMD_CONNECTED, data: {
            session: player.session,
            state:   player.state,
        }}]);
        // 8. Check player visible chunks
        this.checkPlayerVisibleChunks(player, player.state.chunk_render_dist, true);
    }

    // onLeave
    async onLeave(player) {
        if(this.players.has(player.session.user_id)) {
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

    // Возвращает игровое время
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

    // Send commands for all except player id list
    sendAll(packets, except_players) {
        for(let player of this.players.values()) {
            if(except_players && except_players.indexOf(player.session.user_id) >= 0) {
                continue;
            }
            player.sendPackets(packets);
        }
    }

    // Отправить только указанным
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

    // teleportPlayer...
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
            this.checkPlayerVisibleChunks(player, player.state.chunk_render_dist, true)
        }
    }

    // changePlayerPosition...
    changePlayerPosition(player, params) {
        if (params.pos.y < 1) {
            this.teleportPlayer(player, {
                place_id: 'spawn'
            })
            return;
        }
        player.state.pos                = new Vector(params.pos);
        player.state.rotate             = new Vector(params.rotate);
        player.state.chunk_render_dist  = params.chunk_render_dist;
        player.position_changed         = true;
    }

    // Spawn new mob
    async spawnMob(player, params) {
        if(!this.admins.checkIsAdmin(player)) {
            throw 'error_not_permitted';
        }
        let mob = await Mob.create(this, params);
        let chunk = this.chunks.get(mob.chunk_addr.toHash());
        if(chunk) {
            chunk.addMob(mob);
        }
        return true;
    }

    // Check player visible chunks
    checkPlayerVisibleChunks(player, chunk_render_dist, force) {
        // player.sendPackets([{name: ServerClient.CMD_NEARBY_MODIFIED_CHUNKS, data: []}]);
        player.chunk_addr = getChunkAddr(player.state.pos);
        if (force || !player.chunk_addr_o.equal(player.chunk_addr)) {
            // чанки, находящиеся рядом с игроком, у которых есть модификаторы
            let modified_chunks = [];
            let x_rad = chunk_render_dist + 5;
            let y_rad = 5
            let z_rad = chunk_render_dist + 5;
            for (let x = -x_rad; x < x_rad; x++) {
                for (let y = -y_rad; y < y_rad; y++) {
                    for (let z = -z_rad; z < z_rad; z++) {
                        let vec = player.chunk_addr.add(new Vector(x, y, z));
                        if (this.chunkHasModifiers(vec)) {
                            modified_chunks.push(vec);
                            // this.loadChunkForPlayer(player, *vec)
                        }
                    }
                }
            }
            // cnt := len(modified_chunks)
            // this.SendSystemChatMessage("Chunk changed to "+fmt.Sprintf("%v", player.chunk_addr)+" ... "+strconv.Itoa(cnt), []string{})
            let packets = [{
                name: ServerClient.CMD_NEARBY_MODIFIED_CHUNKS,
                data: modified_chunks
            }];
            this.sendSelected(packets, [player.session.user_id], []);
            player.chunk_addr_o = player.chunk_addr;
        }
    }

    // Restore modified chunks list
    async restoreModifiedChunks() {
        this.chunkModifieds = new Set();
        let list = await this.db.chunkBecameModified();
        for(let addr of list) {
            this.chunkBecameModified(addr);
        }
        return true;
    }

    // Chunk has modifiers
    chunkHasModifiers(addr) {
        return this.chunkModifieds.has(addr.toHash());
    }
    
    // Add chunk to modified
    chunkBecameModified(addr) {
        this.chunkModifieds.add(addr.toHash());
    }

    // Юзер начал видеть этот чанк
    async loadChunkForPlayer(player, addr) {
        // получим чанк
        let chunk = await this.chunkGet(addr);
        // запомним, что юзер в этом чанке
        chunk.addPlayer(player);
        return chunk;
    }

    //
    async chunkGet(addr) {
        let chunk = this.chunks.get(addr.toHash());
        if(chunk) {
            return chunk
        }
        chunk = new ServerChunk(this, addr);
        this.chunks.set(addr.toHash(), chunk);
        await chunk.load();
        return chunk;
    }

    //
    async setBlock(player, params) {
        // @ParamBlockSet
        // Ignore bedrock for non admin
        let is_admin = this.admins.checkIsAdmin(player);
        if (params.item.id != 1 || is_admin) {
            let chunkAddr = getChunkAddr(params.pos);
            let chunk = await this.chunkGet(chunkAddr);
            if (await chunk.blockSet(player, params, false)) {
                await this.db.blockSet(this, player, params);
                this.chunkBecameModified(chunkAddr);
            }
        }
    }

    // Create entity
    async createEntity(player, params) {
        // @ParamBlockSet
        let chunkAddr = getChunkAddr(params.pos);
        let chunk = await this.chunkGet(chunkAddr);
        await chunk.blockSet(player, params, false);
        await this.db.blockSet(this, player, params);
        this.chunkBecameModified(chunkAddr);
    }

}