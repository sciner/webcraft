import url from 'url';
import {WebSocketServer} from "ws";

import {DBGame} from "./db/game.js";
import {DBWorld} from "./db/world.js";
import {ServerWorld} from "./server_world.js";
import {ServerPlayer} from "./server_player.js";
import {GameLog} from './game_log.js';
import { BLOCK } from '@client/blocks.js';
import { SQLiteServerConnector } from './db/connector/sqlite.js';
import { BuildingTemplate } from "@client/terrain_generator/cluster/building_template.js";
import { WORKER_MESSAGE } from '@client/constant.js';

class FakeHUD {
    add() {}
    refresh() {}
}

class FakeHotbar {
    setInventory(items) {}
}

export class ServerGame {
    dt_started: Date;
    is_server: boolean;
    worlds          = new Map<string, ServerWorld>()
    worlds_loading  = new Map<string, [Promise<ServerWorld | null>, Function]>() // 2-й член - resolve от этого промиса
    shutdownPromise: Promise<any>;
    shutdownGentle: boolean;
    hud: FakeHUD;
    hotbar: FakeHotbar;
    timerLoadWorld: NodeJS.Timeout;
    lightWorker: any;
    db: DBGame;
    wsServer: WebSocketServer;

    constructor() {
        this.dt_started = new Date();
        this.is_server = true;
        // Worlds
        this.shutdownPromise = null;
        this.shutdownGentle = false;
        // Placeholder
        this.hud = new FakeHUD();
        this.hotbar = new FakeHotbar();
        // load world queue
        this.timerLoadWorld = setTimeout(this.processWorldQueue.bind(this), 10);

        this.lightWorker = null;

        process.on('SIGTERM', () => {
            this.shutdown('!langShutdown by SIGTERM', false)
        });
    }

    /**
     * @param msg - broadcasted to all players in all worlds
     * @param gentle - if it's true, each world will start its shutdown only after its
     *   actions_queue is empty
     * @return true if success
     */
    shutdown(msg : string, gentle : boolean) : boolean {
        if (this.shutdownPromise) {
            // speed up shutdown, if posible
            if (this.shutdownGentle && !gentle) {
                this.shutdownGentle = false
                for(const world of this.worlds.values()) {
                    if (world.shuttingDown) { // skip worlds that were created after shutdown order
                        world.shuttingDown.gentle = false
                    }
                }
                return true
            }
            return false
        }
        console.warn(msg)
        const promises = []
        for(const world of this.worlds.values()) {
            world.chat.broadcastSystemChatMessage(msg)
            const promise = new Promise(resolve => {
                world.shuttingDown = {
                    resolve,
                    gentle
                }
            })
            promises.push(promise)
        }
        this.shutdownGentle = gentle
        this.shutdownPromise = Promise.all(promises).then(() => {
            console.log('Shutdown complete.')
            process.exit()
        })
        return true
    }

    //
    async processWorldQueue() {
        if (this.shutdownPromise) {
            return // don't load new worlds when shutting down
        }
        for(const world_guid of this.worlds_loading.keys()) {
            const worlds_loading_resolve = this.worlds_loading.get(world_guid)[1]
            try {
                console.log(`>>>>>>> BEFORE LOAD WORLD ${world_guid} <<<<<<<`);
                const p = performance.now();
                const [worldRow, conn] = await Promise.all([
                    this.db.getWorld(world_guid),
                    SQLiteServerConnector.connect(`../world/${world_guid}/world.sqlite`)
                ])
                const world = new ServerWorld(BLOCK);
                const db_world = await DBWorld.openDB(conn, world);
                await world.initServer(world_guid, db_world, worldRow, this);
                this.worlds.set(world_guid, world);
                console.log('World started', (Math.round((performance.now() - p) * 1000) / 1000) + 'ms');
                worlds_loading_resolve(world)
            } catch(e) { // чтобы не было unhandled rejection
                console.error(`World ${world_guid} can't start: ${e}`)
                worlds_loading_resolve(null)
            }
            this.worlds_loading.delete(world_guid)
            break;
        }
        clearTimeout(this.timerLoadWorld);
        this.timerLoadWorld = setTimeout(this.processWorldQueue.bind(this), 10);
    }

    /** @returns существующий мир или null */
    async getWorld(world_guid : string) : Promise<ServerWorld | null> {
        // если мир уже загружен
        const world = this.worlds.get(world_guid)
        if (world) {
            return world
        }
        // если грузится сейчас
        const promiseTuple = this.worlds_loading.get(world_guid)
        if (promiseTuple) {
            return promiseTuple[0]
        }
        // не загружен и не грузится - начать грузить
        let resolve: Function
        const promise = new Promise<ServerWorld>(  res => resolve = res )
        this.worlds_loading.set(world_guid, [promise, resolve])
        return promise
    }

    // Start websocket server
    async start(config) {
        const conn = await SQLiteServerConnector.connect('./game.sqlite3');
        await DBGame.openDB(conn).then((db) => {
            this.db = db;
            (global as any).Log = new GameLog(this.db);
        });
        await this.initWorkers()
        await this.initBuildings(config)
        await this.initWs()
    }

    initWorkers() : Promise<number> {
        return new Promise((resolve, reject) => {
            let workerCounter = 1;

            this.lightWorker = new Worker(globalThis.__dirname + '/../www/js/light_worker.js');
            this.lightWorker.postMessage(['SERVER', WORKER_MESSAGE.LIGHT_WORKER_INIT, null]);

            this.lightWorker.on('message', (data) => {
                if (data instanceof MessageEvent) {
                    data = data.data;
                }
                const worldId = data[0];
                const cmd = data[1];
                const args = data[2];
                switch (cmd) {
                    case 'worker_inited': {
                        --workerCounter;
                        if (workerCounter === 0) {
                            resolve(workerCounter);
                        }
                        break;
                    }
                    default: {
                        const world = this.worlds.get(worldId);
                        world.chunkManager.onLightWorkerMessage([cmd, args]);
                    }
                }
            });
            let onerror = (e) => {
                debugger;
            };
            this.lightWorker.on('error', onerror);
        });
    }

    /**
     * Load building template schemas
     */
    async initBuildings(config) {
        for(const json of config.building_schemas.list) {
            BuildingTemplate.addSchema(json)
        }
    }

    /**
     * Create websocket server
     */
    async initWs() {

        this.wsServer = new WebSocketServer({noServer: true,
            perMessageDeflate: {
                zlibDeflateOptions: {
                    // See zlib defaults.
                    chunkSize: 1024,
                    memLevel: 7,
                    level: 3
                },
                zlibInflateOptions: {
                    chunkSize: 10 * 1024
                },
                // Other options settable:
                clientNoContextTakeover: true, // Defaults to negotiated value.
                serverNoContextTakeover: true, // Defaults to negotiated value.
                serverMaxWindowBits: 10, // Defaults to negotiated value.
                // Below options specified as default values.
                concurrencyLimit: 10, // Limits zlib concurrency for perf.
                threshold: 1024 // Size (in bytes) below which messages
                // should not be compressed if context takeover is disabled.
            }
        }); // {port: 5701}

        // New player connection
        this.wsServer.on('connection', (conn, req) => {
            if (this.shutdownPromise) {
                return // don't accept connections when shutting down
            }
            console.log('New player connection');
            const query         = url.parse(req.url, true).query;
            const world_guid    = Array.isArray(query.world_guid) ? query.world_guid[0] : query.world_guid;
            const skin_id       = Array.isArray(query.skin_id) ? query.skin_id[0] : query.skin_id;
            // Get loaded world
            this.getWorld(world_guid).then(async (world: ServerWorld | null) => {
                if (this.shutdownPromise) {
                    return // don't join players when shutting down
                }
                if (world == null) {
                    // TODO как-то лучше ответить игрокку что мир не найден
                    conn.close(1000)
                    return
                }
                Log.append('WsConnected', {world_guid, session_id: query.session_id});
                const player = new ServerPlayer();
                await player.onJoin(query.session_id as string, skin_id, conn, world);
                const game_world = await this.db.getWorld(world_guid);
                await this.db.IncreasePlayCount(game_world.id, query.session_id);
            }).catch((e) => { // чтобы не было unhandled rejection
                console.error(e)
                conn.close(1000)
                return
            })
        });

    }

}