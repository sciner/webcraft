import {ChunkManager} from "./chunk_manager.js";
import {MobManager} from "./mob_manager.js";
import {DropItemManager} from "./drop_item_manager.js";
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

        this.chunkManager           = new ChunkManager(this);
        this.mobs                   = new MobManager(this);
        this.drop_items             = new DropItemManager(this)
        this.players                = new PlayerManager(this);
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
                this.setInfo(cmd);
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

            this.server.AddCmdListener([ServerClient.CMD_STOP_PLAY_DISC], (cmd) => {
                for(let params of cmd.data) {
                    TrackerPlayer.stop(params.pos);
                }
            });

            // Connect
            await this.server.connect(() => {

            }, () => {
                location.reload();
            });
        });
    }

    init (settings) {
        this.settings = settings;
    }

    // Это вызывается после того, как пришло состояние игрока от сервера после успешного подключения
    setInfo({data: info, time}) {
        this.info           = info;
        this.dt_connected   = time; // Серверное время, когда произошло подключение к серверу!

        // Init
        this.players.init();
        this.chunkManager.init();
        this.mobs.init();
        this.drop_items.init();
    }

    joinPlayer(player) {}

    // Возвращает игровое время
    getTime() {
        if(!this.info?.calendar) {
            return null;
        }

        const {
            day_time, age
        } = this.info.calendar;

        const add       = (this.serverTime - this.dt_connected) / 1000 / 1200 * 24000;
        const time      = (day_time + 6000 + add) % 24000;

        const hours = time / 1000 | 0;
        const minutes = (time - hours * 1000) / 1000 * 60 | 0;
        const minutes_string = minutes.toFixed(0).padStart(2, '0');
        const hours_string   = hours.toFixed(0).padStart(2, '0');

        return {
            time:       time, // max value is 24_000
            day:        age,
            hours:      hours,
            minutes:    minutes,
            string:     hours_string + ':' + minutes_string
        };
    }

    getBlock(x, y, z) {
        return this.chunkManager.getBlock(x, y, z);
    }

    // Change block extra_data
    changeBlockExtraData(pos, extra_data) {
        const e = {
            id: +new Date(),
            pos: pos, // {x: pos.x, y: pos.y, z: pos.z, n: Vector.ZERO, point: Vector.ZERO},
            createBlock: false,
            destroyBlock: false,
            cloneBlock: false,
            changeExtraData: true,
            start_time: performance.now(),
            shift_key: false,
            button_id: MOUSE.BUTTON_RIGHT,
            number: 1,
            extra_data: extra_data
        };
        // @server Отправляем на сервер инфу о взаимодействии с окружающим блоком
        this.server.Send({
            name: ServerClient.CMD_PICKAT_ACTION,
            data: e
        });
    }

}