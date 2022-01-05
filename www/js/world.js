import {ChunkManager} from "./chunk_manager.js";
import {MobManager} from "./mob_manager.js";
import {DropItemManager} from "./drop_item_manager.js";
import {Physics} from "./physics.js";
import {PlayerManager} from "./player_manager.js";
import {ServerClient} from "./server_client.js";

// World container
export class World {

    constructor() {
        this.localPlayer = null;
        this.serverTimeShift = 0;
    }

    get serverTime() {
        return Date.now() - this.serverTimeShift || 1;
    }

    // Create server client and connect to world
    async connectToServer(ws) {
        return new Promise(async (res) => {
            this.server = new ServerClient(ws);
            // Add listeners for server commands
            this.server.AddCmdListener([ServerClient.CMD_HELLO], (cmd) => {
                this.hello = cmd; 
                console.log(cmd.data);
            });

            this.server.AddCmdListener([ServerClient.CMD_WORLD_INFO], (cmd) => {
                this.setInfo(cmd.data);
                res(cmd);
            });

            this.server.AddCmdListener([ServerClient.CMD_PARTICLE_BLOCK_DESTROY], (cmd) => {
                Game.render.destroyBlock(cmd.data.item, cmd.data.pos, false);
            });

            this.server.AddCmdListener([ServerClient.CMD_SYNC_TIME], (cmd) => {
                const { time, data } = cmd;
                const { clientTime } = data;
                const latency = (Date.now() - clientTime) / 2;
                const timeLag = (this.serverTime - time) + latency;

                console.log('Server time synced, serverTime:', time, 'latency:', latency, 'shift:', timeLag);

                this.serverTimeShift = timeLag;
            });

            // Connect
            await this.server.connect(() => {
                this.server.Send({name: ServerClient.CMD_SYNC_TIME, data: {clientTime: Date.now()}});
            }, () => {
                location.reload();
            });
        });
    }

    // Это вызывается после того, как пришло состояние игрока от сервера после успешного подключения
    setInfo(info) {
        this.info                   = info;
        this.dt_connected           = performance.now(); // Время, когда произошло подключение к серверу
        this.chunkManager           = new ChunkManager(this);
        this.mobs                   = new MobManager(this);
        this.drop_items             = new DropItemManager(this)
        this.players                = new PlayerManager(this);
        this.physics                = new Physics(this);
        // Init
        this.mobs.init();
        this.drop_items.init();
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