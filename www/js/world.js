import {GameMode} from "./game_mode.js";
import {ChunkManager} from "./chunk_manager.js";
import {PlayerManager} from "./player_manager.js";
import {MobManager} from "./mob_manager.js";
import {Physics} from "./physics.js";

// World container
export class World {

    constructor() {
        this.players    = new PlayerManager(this);
        this.mobs       = new MobManager(this);
        this.physics    = new Physics(this.world);
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