import url from 'url';
import {WebSocketServer} from "ws";

import {DBGame} from "./db/game.js";
import {DBWorld} from "./db/world.js";
import {ServerWorld} from "./server_world.js";
import {ServerPlayer} from "./server_player.js";
import {GameLog} from './game_log.js';
import { BLOCK } from '../www/js/blocks.js';
import { Helpers, Vector } from '../www/js/helpers.js';
import { syncDirectory } from './server_helpers.js';
import { SQLiteServerConnector } from './db/connector/sqlite.js';
import { BuildingTemplate } from "../www/js/terrain_generator/cluster/building_template.js";
import { SERVER_MUSIC_SOURCE_DIR, SERVER_MUSIC_DIR } from './server_constant.js'

class FakeHUD {
    add() {}
    refresh() {}
}

class FakeHotbar {
    setInventory(items) {}
}

export class ServerGame {

    constructor() {
        this.dt_started = new Date();
        this.is_server = true;
        // Worlds
        this.worlds = new Map();
        this.worlds_loading = new Map();
        // Placeholder
        this.hud = new FakeHUD();
        this.hotbar = new FakeHotbar();
        // load world queue
        this.timerLoadWorld = setTimeout(this.processWorldQueue.bind(this), 10);

        this.lightWorker = null;
    }

    //
    async processWorldQueue() {
        for(const [world_guid, _] of this.worlds_loading.entries()) {
            console.log(`>>>>>>> BEFORE LOAD WORLD ${world_guid} <<<<<<<`);
            const p = performance.now();
            const worldTitlePromise = this.db.getWorld(world_guid);
            const conn = await SQLiteServerConnector.connect(`../world/${world_guid}/world.sqlite`);
            const world = new ServerWorld(BLOCK);
            const db_world = await DBWorld.openDB(conn, world);
            const title = (await worldTitlePromise).title;
            await world.initServer(world_guid, db_world, title);
            this.worlds.set(world_guid, world);
            this.worlds_loading.delete(world_guid);
            console.log('World started', (Math.round((performance.now() - p) * 1000) / 1000) + 'ms');
            break;
        }
        clearTimeout(this.timerLoadWorld);
        this.timerLoadWorld = setTimeout(this.processWorldQueue.bind(this), 10);
    }

    //
    getLoadedWorld(world_guid) {
        const world = this.worlds.get(world_guid);
        if(world) return world;
        if(this.worlds_loading.has(world_guid)) return null;
        this.worlds_loading.set(world_guid, true);
        return null;
    }

    // Start websocket server
    async start(config) {

        // Copy the updated music from an external repo to the place where it's served from. Don't await completion.
        syncDirectory(SERVER_MUSIC_SOURCE_DIR, SERVER_MUSIC_DIR).then(changed => {
            if (changed) {
                console.log('The music directory was updated')
            }
        }, err => {
            console.error(err)
        })
        //
        const conn = await SQLiteServerConnector.connect('./game.sqlite3');
        await DBGame.openDB(conn).then((db) => {
            this.db = db
            global.Log = new GameLog(this.db);
        });
        await this.initWorkers();

        // Load building template schemas
        for(let item of config.building_schemas) {
            await Helpers.fetchJSON(`../../node_server/data/building_schema/${item.name}.json`, true, 'bs').then((json) => {

                // fix entrance
                if(item.name == 'test225') {
                    const fix = new Vector(0, 1, 0)
                    item.pos1.y -= fix.y
                    item.pos2.y -= fix.y
                    //json.world.entrance.x += fix.x
                    // json.world.entrance.y += fix.y
                    //json.world.entrance.z += fix.z
                    for(let block of json.blocks) {
                        block.move.x += fix.x
                        block.move.y += fix.y
                        block.move.z += fix.z
                    }
                     fs.writeFileSync(`./data/building_schema/${item.name}.json`, JSON.stringify(json))
                }

                json.name = item.name
                json.meta = json.meta ?? {}
                item.entrance = new Vector(json.world.entrance)

                json.world = {...json.world, ...item}
                BuildingTemplate.addSchema(json)
            })
        }

        // Create websocket server
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
            console.log('New player connection');
            const query         = url.parse(req.url, true).query;
            const world_guid    = query.world_guid;
            // Get loaded world
            let world = this.getLoadedWorld(world_guid);
            const onWorld = async () => {
                Log.append('WsConnected', {world_guid, session_id: query.session_id});
                const player = new ServerPlayer();
                player.onJoin(query.session_id, parseFloat(query.skin), conn, world);
                const game_world = await this.db.getWorld(world_guid);
                await this.db.IncreasePlayCount(game_world.id, query.session_id);
            };
            if(world) {
                onWorld();
            } else {
                new Promise(resolve => {
                    const hInterval = setInterval(() => {
                        world = this.getLoadedWorld(world_guid);
                        if(world) {
                            clearInterval(hInterval);
                            resolve();
                        }
                    }, 10);
                }).then(onWorld);
            }
        });
    }

    initWorkers() {
        return new Promise((resolve, reject) => {
            let workerCounter = 1;

            this.lightWorker = new Worker(globalThis.__dirname + '/../www/js/light_worker.js');
            this.lightWorker.postMessage(['SERVER', 'init', null]);

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
                            resolve();
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
}