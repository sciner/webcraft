import {ChunkManager} from "./chunk_manager.js";
import {GameMode} from "./game_mode.js";
import {PlayerManager} from "./player_manager.js";
import {MobManager} from "./mob_manager.js";
import {ServerClient} from "./server_client.js";

// World container
export class World {

    constructor() {
        this.players = new PlayerManager(this);
        this.mobs = new MobManager(this);
    }

    // Create server client and connect to world
    async connect(server_url, session_id, world_guid) {
        return new Promise(res => {
            const server = new ServerClient(server_url, session_id, () => {
                this.server = server;
                this.server.Send({name: ServerClient.CMD_CONNECT, data: {world_guid: world_guid}});
                res(this.server);
            });
        });
    }

    // Это вызывается после того, как пришло состояние игрока от сервера после успешного подключения
    setInfo(info) {
        this.info                   = info;
        this.dt_connected           = performance.now(); // Время, когда произошло подключение к серверу
        this.game_mode              = new GameMode(this, info.game_mode);
        this.chunkManager           = new ChunkManager(this);
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

}