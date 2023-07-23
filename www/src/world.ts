import {ChunkManager} from "./chunk_manager.js";
import {MobManager} from "./mob_manager.js";
import {DropItemManager} from "./drop_item_manager.js";
import {PlayerManager} from "./player_manager.js";
import {BLOCK_ACTION, ServerClient} from "./server_client.js";
import { Lang } from "./lang.js";
import { SimpleQueue, Vector } from "./helpers.js";
import {ChestHelpers, TChestInfo} from "./block_helpers.js";
import { BuildingTemplate } from "./terrain_generator/cluster/building_template.js";
import { MOUSE, WORLD_TYPE_BUILDING_SCHEMAS } from "./constant.js";
import type { BLOCK } from "./blocks";
import type { TBlock } from "./typed_blocks3.js";
import { WorldHistory } from "./history.js";
import type { WorldAction } from "./world_action.js";
import type { Player } from "./player.js";
import type {ICmdPickatData} from "./pickat.js";
import type {Physics} from "./prismarine-physics/index.js";
import {ClientDrivingManager} from "./control/driving_manager.js";
import type {GameClass} from "./game.js";
import type {GameSettings} from "./game.js";
import { ChunkGrid } from "./core/ChunkGrid.js";

// World container
export class World implements IWorld {
    readonly game:          GameClass
    latency:                number = 0
    info?:                  TWorldInfo | null
    serverTimeShift:        number = 0
    settings:               TWorldSettings
    chunkManager:           ChunkManager
    mobs:                   MobManager
    drop_items:             DropItemManager
    players:                PlayerManager
    drivingManager:         ClientDrivingManager
    blockModifierListeners: Function[]
    block_manager:          typeof BLOCK
    server?:                ServerClient
    hello?:                 IChatCommand
    history:                any = new WorldHistory(this)
    physics?:               Physics
    private dt_update_time: number // Серверное время, когда произошло подключение к серверу!
    private dt_connected:   number

    static TIME_SYNC_PERIOD = 5000;

    private lastMeasuredQueudLag = 0
    private unansweredQueudLagTimes = new SimpleQueue<number>()
    grid: ChunkGrid;

    constructor(game: GameClass, settings : GameSettings, block_manager : typeof BLOCK) {

        this.game = game
        this.settings = settings;
        this.block_manager = block_manager;

        this.chunkManager           = new ChunkManager(this);
        this.mobs                   = new MobManager(this);
        this.drop_items             = new DropItemManager(this)
        this.players                = new PlayerManager(this);
        this.drivingManager         = new ClientDrivingManager(this);
        this.blockModifierListeners = [];
    }

    /** Closes the connection on an unrecoverable error */
    terminate(err: any) {
        console.error(`Connection is closed due to ${err}`)
        this.server.ws.close(1000)
    }

    get serverTimeWithLatency() {
        const MIN_LATENCY = 60
        return this.serverTime - Math.max(this.latency, MIN_LATENCY)
    }

    get serverTime() {
        return Date.now() - this.serverTimeShift || 0;
    }

    get serverQueueLag(): number {
        let res = this.lastMeasuredQueudLag
        const lastUnanswered = this.unansweredQueudLagTimes.getFirst()
        if (lastUnanswered != null) {
            res = Math.max(res, performance.now() - lastUnanswered)
        }
        return Math.round(res)
    }

    queryTimeSync() {
        if(!this.server) {
            throw 'error_server_not_inited'
        }
        // SERVER MUST answer ASAP, because this is required for time-syncing
        this.server.Send({name: ServerClient.CMD_SYNC_TIME, data: {clientTime: Date.now()}});

        // Measure the actual game lag in the commands queue
        const now = Math.floor(performance.now())
        this.server.Send({name: ServerClient.CMD_QUEUED_PING, data: now})
        this.unansweredQueudLagTimes.push(now)

        setTimeout(() => this.queryTimeSync(), World.TIME_SYNC_PERIOD);
    }

    onTimeSync(cmd : IChatCommand) {
        const { time, data } = cmd;
        const { clientTime } = data;
        const now     = Date.now();
        const latency = (now - clientTime) / 2;
        const timeLag = (now - time) + latency;

        console.debug('Server time synced, serverTime:', time, 'latency:', latency, 'shift:', timeLag);

        this.latency         = latency;
        this.serverTimeShift = timeLag;
    }

    private onQueudPing(cmd: INetworkMessage<number>): void {
        const now = performance.now()
        this.lastMeasuredQueudLag = now - cmd.data
        const queue = this.unansweredQueudLagTimes
        while(queue.length && queue.getFirst() <= cmd.data) {
            queue.shift()
        }
    }

    // Create server client and connect to world
    async connectToServer(ws) {
        return new Promise(async (res) => {
            const server = this.server = new ServerClient(ws);
            // Add listeners for server commands
            this.server.AddCmdListener([ServerClient.CMD_HELLO], (cmd : IChatCommand) => {
                this.hello = cmd;
                console.log(cmd.data);
                this.queryTimeSync();
            });

            this.server.AddCmdListener([ServerClient.CMD_WORLD_INFO], (cmd : IChatCommand) => {
                console.log('cmd')
                this.setInfo(cmd);
                res(cmd);
            });

            this.server.AddCmdListener([ServerClient.CMD_WORLD_UPDATE_INFO], (cmd : IChatCommand) => {
                this.updateInfo(cmd);
            });

            this.server.AddCmdListener([ServerClient.CMD_PARTICLE_BLOCK_DESTROY], (cmd : IChatCommand) => {
                Qubatch.render.destroyBlock(cmd.data.item, cmd.data.pos, false);
            });

            this.server.AddCmdListener([ServerClient.CMD_GENERATE_PARTICLE], (cmd : IChatCommand) => {
                Qubatch.render.addParticles(cmd.data);
            });

            this.server.AddCmdListener([ServerClient.CMD_SYNC_TIME], this.onTimeSync.bind(this));

            this.server.AddCmdListener([ServerClient.CMD_QUEUED_PING], this.onQueudPing.bind(this))

            this.server.AddCmdListener([ServerClient.CMD_SET_WEATHER], (cmd : IChatCommand) => {
                Qubatch.render.setWeather(cmd.data, this.chunkManager);
            });

            this.server.AddCmdListener([ServerClient.CMD_STOP_PLAY_DISC], (cmd : IChatCommand) => {
                for(let params of cmd.data) {
                    // TODO: Not found global variable?
                    TrackerPlayer.stop(params.pos);
                }
            });

            server.AddCmdListener([ServerClient.CMD_DRIVING_ADD_OR_UPDATE, ServerClient.CMD_DRIVING_DELETE], (cmd: INetworkMessage) => {
                this.drivingManager.onCmd(cmd)
            })

            // Add or update building schemas
            this.server.AddCmdListener([ServerClient.CMD_BUILDING_SCHEMA_ADD], (cmd) => {
                this.chunkManager.postWorkerMessage(['buildingSchemaAdd', cmd.data]);
                for(let schema of cmd.data.list) {
                    BuildingTemplate.addSchema(schema);
                }
            });

            // Connect
            await this.server.connect(() => {

            }, () => {
                Qubatch.exit();
            });
        });
    }

    // Это вызывается после того, как пришло состояние игрока от сервера после успешного подключения
    setInfo({data: info, time}) {
        this.info           = info;
        this.dt_connected   = time; // Серверное время, когда произошло подключение к серверу!
        this.dt_update_time = time;

        this.block_manager.applyRulesForWorld(this)

        // Init
        this.players.init();
        this.grid = new ChunkGrid({chunkSize: new Vector().copyFrom(this.info.tech_info.chunk_size)})
        this.chunkManager.init();
        this.mobs.init();
        this.drop_items.init();
    }

    updateInfo({data: info, time}) {
        this.info = info;
        this.dt_update_time = time;
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

        const add       = (this.serverTime - this.dt_update_time) / 1000 / 1200 * 24000;
        const time      = (day_time + add) % 24000;

        const hours = time / 1000 | 0;
        const minutes = (time - hours * 1000) / 1000 * 60 | 0;
        const minutes_string = minutes.toFixed(0).padStart(2, '0');
        const hours_string   = hours.toFixed(0).padStart(2, '0');

        let time_visible = time;

        // If daylight cycle stop by rules
        if('doDaylightCycle' in this.info.rules) {
            if(!this.info.rules.doDaylightCycle) {
                time_visible = this.info.rules.doDaylightCycleTime;
            }
        }

        const ageToDate = (day: number, hours: number) => {
            let month = Math.floor(day / 30)
            let year = Math.floor(month / 12)
            day %= 30
            month %= 12
            const resp = []
            if(year > 0) {
                resp.push(year + ' y')
            }
            if(month > 0) {
                resp.push(month + ' m')
            }
            if(day > 0) {
                resp.push(day + ' d')
            }
            resp.push(hours + ' h')
            return resp.join(' ')
        }

        return {
            time:           time, // max value is 24_000
            time_visible:   time_visible,
            day:            age,
            hours:          hours,
            minutes:        minutes,
            string:         hours_string + ':' + minutes_string,
            string_full:    ageToDate(age, hours),
        }

    }

    // TODO добавить 2-й параметр - resultBlock: TBlock | null
    getBlock(pos : IVector): TBlock {
        return this.chunkManager.getBlock(pos);
    }

    // Change block extra_data
    changeBlockExtraData(pos : IPickatEventPos, extra_data) {
        const e: ICmdPickatData = {
            id: +new Date(),
            pos: pos, // {x: pos.x, y: pos.y, z: pos.z, n: Vector.ZERO, point: Vector.ZERO},
            createBlock: false,
            destroyBlock: false,
            cloneBlock: false,
            changeExtraData: true,
            start_time: performance.now(),
            shiftKey: false,
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

    /**
     * Apply world actions
     * It's async because the server version has to be async.
     */
    async applyActions(actions: WorldAction, player: Player) {
        if(actions.open_window) {
            player.stopAllActivity();
            let args = null;
            let window_id = actions.open_window;
            if(typeof actions.open_window == 'object') {
                window_id = actions.open_window.id;
                args = actions.open_window.args;
            }
            const w = Qubatch.hud.wm.getWindow(window_id);
            if(w) {
                w.show(args);
            } else {
                console.error('error_window_not_found', actions.open_window);
            }
        }
        if(actions.error) {
            console.error(actions.error);
        }
        if(actions.load_chest) {
            player.stopAllActivity();
            var info = actions.load_chest
            var window = info.window;
            var secondInfo: TChestInfo | null = null;
            if (window === 'frmChest') {
                secondInfo = ChestHelpers.getSecondHalf(this, info.pos);
                if (secondInfo) {
                    window = 'frmDoubleChest';
                    if (secondInfo.extra_data.type === 'right') {
                        const t = info;
                        info = secondInfo;
                        secondInfo = t;
                    }
                }
            }
            Qubatch.hud.wm.getWindow(window).load(info, secondInfo);
        }
        if(actions.play_sound) {
            for(let item of actions.play_sound) {
                Qubatch.sounds.play(item.tag, item.action);
            }
        }
        if(actions.reset_mouse_actions) {
            player.resetMouseActivity();
        }
        if(actions.clone_block) {
            this.server.CloneBlock(actions.clone_block);
            player.inventory.cloneMaterial(new Vector(actions.clone_block), true);
        }
        //
        if(actions.blocks && actions.blocks.list) {
            for(let mod of actions.blocks.list) {
                this.setBlockDirect(mod.pos, mod.item, mod.action_id)
            }
        }
        if (actions.fluids.length > 0) {
            this.chunkManager.fluidWorld.applyWorldFluidsList(actions.fluids);
        }
        // Sitting
        if(actions.sitting) {
            player.state.sitting = actions.sitting;
            player.setPosition(actions.sitting.pos);
            player.setRotate(actions.sitting.rotate);
            player.controlManager.setVelocity(0, 0, 0)
                .syncWithEventId(actions.controlEventId, false)
                .suppressLerpPos()
            Qubatch.hotbar.strings.setText(1, Lang.press_lshift_to_dismount, 4000);
        }
        // Sleep
        if(actions.sleep) {
            player.state.sleep = actions.sleep
            player.setPosition(actions.sleep.pos)
            player.setRotate(actions.sleep.rotate)
            player.controlManager.setVelocity(0, 0, 0)
                .syncWithEventId(actions.controlEventId, false)
                .suppressLerpPos()
            Qubatch.hotbar.strings.setText(1, Lang.press_lshift_to_dismount, 4000)
        }
    }

    /** Sets the block, and performs necessary additional actions, e.g. removing old emitters. */
    setBlockDirect(pos: Vector, item: IBlockItem, action_id: int): TBlock | null {
        //
        const tblock = this.getBlock(pos);
        if (tblock.id < 0) {
            return null // it's outside the chunk
        }
        if(action_id == BLOCK_ACTION.DESTROY && tblock.id > 0) {
            const destroy_data = {
                pos,
                item: {id: tblock.id} as IBlockItem
            };
            if(tblock.extra_data) {
                destroy_data.item.extra_data = tblock.extra_data
            }
            Qubatch.render.destroyBlock(destroy_data.item, destroy_data.pos.clone().addScalarSelf(.5, .5, .5), false)
            this.onBlockDestroy(destroy_data.pos, destroy_data.item);
        }
        //
        Qubatch.render.meshes.effects.deleteBlockEmitter(pos);
        this.chunkManager.setBlock(pos, item)
        return tblock
    }

    onBlockDestroy(pos, item) {
        // Destroy beacon ray
        Qubatch.render.meshes.remove('beacon/' + pos.toHash(), this);
    }

    isBuildingWorld() {
        return this.info.world_type_id == WORLD_TYPE_BUILDING_SCHEMAS
    }

    get chunks() {
        return this.chunkManager.chunks;
    }

    updateLocalBlock(pos: any, extra_data?: any, rotate? : Vector) : boolean {
        const tblock = this.getBlock(pos)
        if(tblock.id >= 0) {
            const item : IBlockItem = {
                id: tblock.id,
                extra_data,
                rotate: tblock.rotate
            }
            if(tblock.entity_id) {
                item.entity_id = tblock.entity_id
            }
            this.chunkManager.setBlock(pos, item)
            return true
        }
        return false
    }

}