import url from 'url';
import {WebSocketServer} from "ws";
import { DBGame } from "./db/game.js";
import { GameLog } from './game_log.js';
import { SQLiteServerConnector } from './db/connector/sqlite.js';
import { ServerWorkerWorld } from 'server/worker_world.js';
import type { Config } from 'config.js';
import {SERVER_WORLD_WORKER_MESSAGE} from "@client/constant.js";

class FakeHUD {
    add() {}
    refresh() {}
}

class FakeHotbar {
    setInventory(items) {}
}

export class ServerGame {
    dt_started:         Date
    is_server:          boolean
    worlds:             Map<string, ServerWorkerWorld> = new Map<string, ServerWorkerWorld>()
    worlds_loading:     Map<string, [Promise<ServerWorkerWorld | null>, Function]> = new Map<string, [Promise<ServerWorkerWorld | null>, Function]>() // 2-й член - resolve от этого промиса
    shutting_down:      boolean = false // ture если сейчас в процесе выключения
    hud:                FakeHUD
    hotbar:             FakeHotbar
    timerLoadWorld:     NodeJS.Timeout
    db:                 DBGame
    wsServer:           WebSocketServer
    config:             Config

    constructor(config: Config) {
        this.config = config
        this.dt_started = new Date();
        this.is_server = true;
        // Placeholder
        this.hud = new FakeHUD();
        this.hotbar = new FakeHotbar();
        // load world queue
        this.timerLoadWorld = setTimeout(this.processWorldQueue.bind(this), 10);
        process.on('SIGTERM', () => {
            this.shutdown('!langShutdown by SIGTERM')
        })
    }

    /**
     * @param msg - broadcasted to all players in all worlds
     * @return true if success
     */
    shutdown(msg : string) : void {
        if (!this.shutting_down) {
            this.shutting_down = true
            console.warn(msg)
            this.checkShutdown()
            for(const world of this.worlds.values()) {
                world.broadcastSystemChatMessage(msg)
                world.worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.shutdown])
            }
        }
    }

    //
    async processWorldQueue() {
        if (this.shutting_down) {
            return // don't load new worlds when shutting down
        }
        for(const world_guid of this.worlds_loading.keys()) {
            const worlds_loading_resolve = this.worlds_loading.get(world_guid)[1]
            try {
                console.log(`>>>>>>> BEFORE LOAD WORLD ${world_guid} <<<<<<<`)
                const p = performance.now();
                const worldRow = await this.db.getWorld(world_guid)
                const world = new ServerWorkerWorld(this)
                await world.init(worldRow)
                this.worlds.set(world_guid, world)
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
    async getWorld(world_guid : string) : Promise<ServerWorkerWorld | null> {
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
        const promise = new Promise<ServerWorkerWorld>(  res => resolve = res )
        this.worlds_loading.set(world_guid, [promise, resolve])
        return promise
    }

    deleteWorld(world: ServerWorkerWorld): void {
        this.worlds.delete(world.guid)
        world.onDelete()
        console.log(`World unloaded: ${world.guid}`)
        this.checkShutdown()
    }

    // Start websocket server
    async start(config : Config) {
        const conn = await SQLiteServerConnector.connect('./game.sqlite3')
        await DBGame.openDB(conn).then((db : DBGame) => {
            this.db = db;
            (global as any).Log = new GameLog(this.db)
        });
        await this.initWs()
        await this.db.skins.load()
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
            if (this.shutting_down) {
                return // don't accept connections when shutting down
            }
            console.log('New player connection');
            const query         = url.parse(req.url, true).query;
            const world_guid    = Array.isArray(query.world_guid) ? query.world_guid[0] : query.world_guid
            const skin_id       = Array.isArray(query.skin_id) ? query.skin_id[0] : query.skin_id
            const session_id    = Array.isArray(query.session_id) ? query.session_id[0] : query.session_id
            // Get loaded world
            this.getWorld(world_guid).then(async (world: ServerWorkerWorld | null) => {
                if (this.shutting_down) {
                    return // don't join players when shutting down
                }
                if (world == null) {
                    // TODO: как-то лучше ответить игроку что мир не найден
                    conn.close(1000)
                    return
                }
                Log.append('WsConnected', {world_guid, session_id: session_id})
                await world.addPlayer(conn, session_id, skin_id)
                const game_world = await this.db.getWorld(world_guid)
                await this.db.IncreasePlayCount(game_world.id, query.session_id)
            }).catch((e) => { // чтобы не было unhandled rejection
                console.error(e)
                conn.close(1000)
                return
            })
        });

    }

    /** Если ждали завершения, и не осталось миров - то завершить работу */
    private checkShutdown(): void {
        if (this.shutting_down && this.worlds.size === 0) {
            console.log('Shutdown complete.')
            process.exit()
        }
    }
}