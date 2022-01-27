import {ChunkManager} from "./chunk_manager.js";
import {MobManager} from "./mob_manager.js";
import {DropItemManager} from "./drop_item_manager.js";
import {Physics} from "./physics.js";
import {PlayerManager} from "./player_manager.js";
import {ServerClient} from "./server_client.js";
import {Particles_Painting} from "./particles/painting.js";

/**
 * World generation unfo passed from server
 * @typedef {Object} TWorldInfo
 * @property {{id: string}} generator
 * @property {string} game_mode 
 * @property {string} guid
 * @property {number} id
 * @property {{x: number, y: number, z: number}} pos_spawn
 * @property {string} seed
 * @property {Object} state
 * @property {string} title
 * @property {number} user_id 
 */

// World container
export class World {
    static MIN_LATENCY = 60;
    static TIME_SYNC_PERIOD = 10000;

    constructor(settings) {
        /**
         * @type {TWorldInfo}
         */
        this.info = null;
        this.localPlayer = null;
        this.settings = settings;
        this.serverTimeShift = 0;
        this.latency = 0;
    }

    get serverTimeWithLatency() {
        return this.serverTime - Math.max(this.latency, World.MIN_LATENCY);
    }

    get serverTime() {
        return Date.now() - this.serverTimeShift || 0;
    }

    queryTimeSync() {
        // SERVER MUST answer ASAP, because this is required for time-syncing
        this.server.Send({name: ServerClient.CMD_SYNC_TIME, data: {clientTime: Date.now()}});

        setTimeout(() => this.queryTimeSync(), World.TIME_SYNC_PERIOD);
    }

    onTimeSync(cmd) {
        const { time, data } = cmd;
        const { clientTime } = data;
        const now     = Date.now();
        const latency = (now - clientTime) / 2;
        const timeLag = (now - time) + latency;

        console.debug('Server time synced, serverTime:', time, 'latency:', latency, 'shift:', timeLag);

        this.latency         = latency;
        this.serverTimeShift = timeLag;
    }

    // Create server client and connect to world
    async connectToServer(ws) {
        return new Promise(async (res) => {
            this.server = new ServerClient(ws);
            // Add listeners for server commands
            this.server.AddCmdListener([ServerClient.CMD_HELLO], (cmd) => {
                this.hello = cmd; 
                console.log(cmd.data);

                this.queryTimeSync();
            });

            this.server.AddCmdListener([ServerClient.CMD_WORLD_INFO], (cmd) => {
                this.setInfo(cmd.data);
                res(cmd);
            });

            this.server.AddCmdListener([ServerClient.CMD_PARTICLE_BLOCK_DESTROY], (cmd) => {
                Game.render.destroyBlock(cmd.data.item, cmd.data.pos, false);
            });

            this.server.AddCmdListener([ServerClient.CMD_SYNC_TIME], this.onTimeSync.bind(this));

            this.server.AddCmdListener([ServerClient.CMD_CREATE_PAINTING], (cmd) => {
                for(let params of cmd.data) {
                    Game.render.meshes.add(new Particles_Painting(params));
                }
            });

            // Connect
            await this.server.connect(() => {

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

    getBlock(x, y, z) {
        return this.chunkManager.getBlock(x, y, z);
    }
}