import {ChunkManager} from "../www/js/chunk_manager.js";
import {GameMode} from "../www/js/game_mode.js";
import {MobManager} from "../www/js/mob_manager.js";
import {Physics} from "../www/js/physics.js";
import {PlayerManager} from "../www/js/player_manager.js";

export class ServerWorld {

    constructor() {}

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
        this.players                = new PlayerManager(this);
        this.physics                = new Physics(this);
    }

    joinPlayer(player) {}

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