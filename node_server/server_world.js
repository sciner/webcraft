import {ChunkManager} from "../www/js/chunk_manager.js";
import {GameMode} from "../www/js/game_mode.js";
import {MobManager} from "../www/js/mob_manager.js";
import {Physics} from "../www/js/physics.js";
import {PlayerManager} from "../www/js/player_manager.js";
import {ServerChat} from "./server_chat.js";
import {ServerClient} from "../www/js/server_client.js";

export class ServerWorld {

    constructor() {
        this.chat       = new ServerChat(this);
        this.players    = new Map(); // new PlayerManager(this);
    }

    async initServer(world_guid, Db) {
        this.Db = Db;
        this.info = await this.Db.GetWorld(world_guid);
    }

    // Это вызывается после того, как пришло состояние игрока от сервера после успешного подключения
    setInfo(info) {
        this.info                   = info;
        this.dt_connected           = performance.now(); // Время, когда произошло подключение к серверу
        this.game_mode              = new GameMode(this, info.game_mode);
        this.chunkManager           = new ChunkManager(this);
        this.mobs                   = new MobManager(this);
        this.physics                = new Physics(this);
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
        let params = {
            id:       player.session.user_id,
            username: player.session.username,
            pos:      player.state.pos,
            rotate:   player.state.rotate,
            skin:     player.state.skin
        }
        let packets = [{
            name: ServerClient.CMD_PLAYER_JOIN,
            data: params
        }];
    this.sendAll(packets, [/*player.session.user_id*/]);
        // 6. Write to chat about new player
        this.chat.sendSystemChatMessageToSelectedPlayers(player.session.username + " подключился", this.players.keys());
        // 7. Send CMD_CONNECTED
        let data = {
            session: player.session,
            state:   player.state,
        }
        player.sendPackets([{name: ServerClient.CMD_CONNECTED, data: data}]);
        player.sendPackets([{name: ServerClient.CMD_NEARBY_MODIFIED_CHUNKS, data: []}]);
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

}