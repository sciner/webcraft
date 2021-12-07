import {Mob} from "./mob.js";
import {ServerChat} from "./server_chat.js";
import {EntityManager} from "./entity_manager.js";
import {WorldAdminManager} from "./admin_manager.js";
import {ModelManager} from "./model_manager.js";

import {Vector, VectorCollector} from "../www/js/helpers.js";
import {ServerClient} from "../www/js/server_client.js";
import {getChunkAddr} from "../www/js/chunk.js";

import {ServerChunkManager} from "./server_chunk_manager.js";
// import {GameMode} from "../www/js/game_mode.js";

export class ServerWorld {

    constructor() {}

    async initServer(world_guid, db) {
        this.db             = db;
        this.info           = await this.db.getWorld(world_guid);
        this.entities       = new EntityManager(this);
        this.chat           = new ServerChat(this);
        this.chunks         = new ServerChunkManager(this);
        this.players        = new Map(); // new PlayerManager(this);
        this.mobs           = new Map(); // Store refs to all loaded mobs in the world
        this.models         = new ModelManager();
        this.models.init();
        this.ticks_stat     = {
            last: 0,
            total: 0,
            count: 0,
            min: Number.MAX_SAFE_INTEGER,
            max: 0
        };
        //
        this.admins = new WorldAdminManager(this);
        await this.admins.load();
        //
        await this.restoreModifiedChunks();
        //
        this.tickerWorldTimer = setInterval(() => {
            let pn = performance.now();
            this.tick();
            // Calculate stats of elapsed time for ticks
            this.ticks_stat.total += this.ticks_stat.last = performance.now() - pn;
            this.ticks_stat.count++;
            if(this.ticks_stat.last < this.ticks_stat.min) this.ticks_stat.min = this.ticks_stat.last;
            if(this.ticks_stat.last > this.ticks_stat.max) this.ticks_stat.max = this.ticks_stat.last;
            // console.log('Tick took %sms', Math.round((performance.now() - pn) * 1000) / 1000);
        }, 50);
        //
        this.saveWorldTimer = setInterval(() => {
            // let pn = performance.now();
            this.save();
            // calc time elapsed
            // console.log("Save took %sms", Math.round((performance.now() - pn) * 1000) / 1000);
        }, 5000);
        //
        import('../www/js/terrain_generator/' + this.info.generator.id + '/index.js').then(async (module) => {
            this.generator = new (module.default)(this.info.seed, this.info.guid);
            await this.generator.init('../www');
        });
    }

    // World tick
    tick() {
        // 1.
        this.chunks.tick();
        // 2.
        for(let player of this.players.values()) {
            this.chunks.checkPlayerVisibleChunks(player, false);
        }
        // 3.
        for(let [entity_id, mob] of this.mobs) {
            mob.tick();
        }
    }

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
        this.chunks.checkPlayerVisibleChunks(player, true);
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
            this.chunks.checkPlayerVisibleChunks(player, true);
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
        player.position_changed         = true;
    }

    // Spawn new mob
    async spawnMob(player, params) {
        try {
            if(!this.admins.checkIsAdmin(player)) {
                throw 'error_not_permitted';
            }
            let mob = await Mob.create(this, params);
            this.chunks.get(mob.chunk_addr)?.addMob(mob);
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

    // Restore modified chunks list
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
        this.chunkModifieds.set(addr, addr);
    }

    // Юзер начал видеть этот чанк
    async loadChunkForPlayer(player, addr) {
        let chunk = this.chunks.get(addr);
        if(!chunk) {
            throw 'Chunk not found';
        }
        chunk.addPlayerLoadRequest(player);
    }

    //
    async setBlock(player, params) {
        // @ParamBlockSet
        // Ignore bedrock for non admin
        let is_admin = this.admins.checkIsAdmin(player);
        if (params.item.id != 1 || is_admin) {
            let addr = getChunkAddr(params.pos);
            let chunk = this.chunks.get(addr);
            if(chunk) {
                if (await chunk.blockSet(player, params, false)) {
                    await this.db.blockSet(this, player, params);
                    this.chunkBecameModified(addr);
                }
            } else {
                console.log('setBlock: Chunk not found', addr);
            }
        }
    }

    // Create entity
    async createEntity(player, params) {
        // @ParamBlockSet
        let addr = getChunkAddr(params.pos);
        let chunk = this.chunks.get(addr);
        if(chunk) {
            await chunk.blockSet(player, params, false);
            await this.db.blockSet(this, player, params);
            this.chunkBecameModified(addr);
        } else {
            console.log('createEntity: Chunk not found', addr);
        }
    }

}