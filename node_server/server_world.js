import {Vector} from "../www/js/helpers.js";
import {GameMode} from "../www/js/game_mode.js";
import {Physics} from "../www/js/physics.js";

import {ChunkManager} from "../www/js/chunk_manager.js";
import {MobManager} from "../www/js/mob_manager.js";
import {PlayerManager} from "../www/js/player_manager.js";
import {ServerChat} from "./server_chat.js";
import {ServerClient} from "../www/js/server_client.js";
import {EntityManager} from "./entity_manager.js";
import {WorldAdminManager} from "./admin_manager.js";

export class ServerWorld {

    constructor() {
    }

    tick() {}

    save() {
        for(let player of this.players.values()) {
            this.Db.savePlayerState(player);
        }
    }

    async initServer(world_guid, Db) {
        this.Db         = Db;
        this.info       = await this.Db.GetWorld(world_guid);
        this.entities   = new EntityManager(this);
        this.chat       = new ServerChat(this);
        this.players    = new Map(); // new PlayerManager(this);
        //
        this.restoreModifiedChunks();
        //
        this.admins = new WorldAdminManager(this);
        await this.admins.load();
        //
        this.tickerWorldTimer = setInterval(() => {
            let pn = performance.now();
            this.save()
            this.tick()
            // time elapsed forcurrent tick
            console.log("Tick took %sms", Math.round((performance.now() - pn) * 1000) / 1000);
        }, 5000);
    }

    // onPlayer
    async onPlayer(player, skin) {
        // 1. Insert to DB if new player
        player.state = await this.Db.RegisterUser(this, player);
        player.state.skin = skin;
        // 2. Add new connection
        if (this.players.has(player.session.user_id)) {
            console.log("OnPlayer delete previous connection for:", player.session.username);
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
        this.chat.sendSystemChatMessageToSelectedPlayers(player.session.username + " подключился", this.players.keys());
        // 7. Send CMD_CONNECTED
        player.sendPackets([{name: ServerClient.CMD_CONNECTED, data: {
            session: player.session,
            state:   player.state,
        }}]);
        // 8. Check player visible chunks
        this.checkPlayerVisibleChunks(player, player.state.chunk_render_dist, true);
        /*
        // Fix player position
        if player_state.Pos.Y < 1 {
            player_state.Pos = player_state.PosSpawn
        }
        // 3.
        conn.PosSpawn = *player_state.PosSpawn
        //
        conn.Indicators = player_state.Indicators
        // 8. Send all mobs in the world
        if len(this.Mobs) > 0 {
            packet_mobs := Struct.JSONResponse{Name: Struct.CMD_MOB_ADDED, Data: this.getMobsAsSlice(), ID: nil}
            packets_mobs := []Struct.JSONResponse{packet_mobs}
            this.SendAll(packets_mobs, []string{})
        }
        */
    }

    // onLeave
    async onLeave(player) {
        if(this.players.has(player.session.user_id)) {
            this.players.delete(player.session.user_id);
            this.Db.savePlayerState(player);
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

    // Check player visible chunks
    checkPlayerVisibleChunks(player, chunk_render_dist, force) {
        player.sendPackets([{name: ServerClient.CMD_NEARBY_MODIFIED_CHUNKS, data: []}]);
        /*
        conn.ChunkPos = this.GetChunkAddr(*&Struct.Vector3{
            X: int(conn.Pos.X),
            Y: int(conn.Pos.Y),
            Z: int(conn.Pos.Z),
        })
        if force || !conn.ChunkPosO.Equal(conn.ChunkPos) {
            // чанки, находящиеся рядом с игроком, у которых есть модификаторы
            modified_chunks := []*Struct.Vector3{}
            x_rad := ChunkRenderDist + 5
            y_rad := 5
            z_rad := ChunkRenderDist + 5
            for x := -x_rad; x < x_rad; x++ {
                for y := -y_rad; y < y_rad; y++ {
                    for z := -z_rad; z < z_rad; z++ {
                        vec := &Struct.Vector3{
                            X: conn.ChunkPos.X + x,
                            Y: conn.ChunkPos.Y + y,
                            Z: conn.ChunkPos.Z + z,
                        }
                        if this.ChunkHasModifiers(vec) {
                            modified_chunks = append(modified_chunks, vec)
                            // this.LoadChunkForPlayer(conn, *vec)
                        }
                    }
                }
            }
            // cnt := len(modified_chunks)
            // this.SendSystemChatMessage("Chunk changed to "+fmt.Sprintf("%v", conn.ChunkPos)+" ... "+strconv.Itoa(cnt), []string{})
            packet := Struct.JSONResponse{Name: Struct.CMD_NEARBY_MODIFIED_CHUNKS, Data: modified_chunks, ID: nil}
            packets := []Struct.JSONResponse{packet}
            connections := map[string]*PlayerConn{
                conn.ID: conn,
            }
            this.SendSelected(packets, connections, []string{})
            conn.ChunkPosO = conn.ChunkPos
        }
        */
    }

    // restoreModifiedChunks..
    async restoreModifiedChunks() {
    }

}