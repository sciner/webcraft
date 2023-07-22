import { BLOCK } from "@client/blocks.js";
import type { GameSettings } from "@client/game.js";
import { QubatchWorker } from "../helpers/worker.js";
import { SERVER_WORLD_WORKER_MESSAGE } from "@client/constant.js";
import { ServerWorld } from "server_world.js";
import { SQLiteServerConnector } from "db/connector/sqlite.js";
import { DBWorld } from "db/world.js";
import { ServerPlayer } from "server_player.js";
import { Lang } from "@client/lang.js";
import { PluginManager } from "plugin_manager.js";

//
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import { Worker } from "worker_threads";
import { v4 as uuid } from 'uuid';
import { Buffer } from 'node:buffer';
import skiaCanvas from 'skia-canvas';
import { Config } from "config.js";
import { BuildingTemplate } from "@client/terrain_generator/cluster/building_template.js";
import { ServerClient } from "@client/server_client.js";

declare type IQubatch = {
    is_server: boolean
    world_worker: WorldWorker
}

export class WorldWorker extends QubatchWorker {
    bm:             typeof BLOCK
    guid:           string
    world:          ServerWorld
    db_conn:        any = null
    db_world:       DBWorld = null
    players:        Map<int, ServerPlayer> = new Map()

    constructor() {
        super(SERVER_WORLD_WORKER_MESSAGE.init)
    }

    async onMessage(cmd: string, args: any) {

        switch(cmd) {
            case SERVER_WORLD_WORKER_MESSAGE.init: {
                const p = performance.now()
                const worldRow : IWorldDBRow = args
                const config = await Config.init()
                this.guid = worldRow.guid
                this.initGlobal(config)
                await Lang.init()
                this.initBuildings(config)
                this.world = new ServerWorld(await this.initBlockManager(), worldRow, this)
                const db_world = await this.openDB()
                await this.world.initServer(this.guid, db_world, worldRow.title, this)
                this.world.info.cover = worldRow.cover
                console.log('World started', (Math.round((performance.now() - p) * 1000) / 1000) + 'ms')
                break
            }
            case SERVER_WORLD_WORKER_MESSAGE.on_player: {
                const player = new ServerPlayer()
                this.players.set(args.session.user_id, player)
                await player.onJoin(args.session, args.skin, this, this.world)
                break
            }
            case SERVER_WORLD_WORKER_MESSAGE.player_leave: {
                const player = this.getPlayer(args.session as PlayerSession)
                if(player) {
                    this.players.delete(player.session.user_id)
                    this.world.onLeave(player)
                    if(this.players.size == 0) {
                        this.postMessage(SERVER_WORLD_WORKER_MESSAGE.need_to_unload)
                    }
                }
                break
            }
            case SERVER_WORLD_WORKER_MESSAGE.player_command: {
                const player = this.getPlayer(args.session as PlayerSession)
                if(player) {
                    player.onMessage(args.cmd)
                }
                break
            }
            case SERVER_WORLD_WORKER_MESSAGE.broadcast_chat_message: {
                this.world.chat.broadcastSystemChatMessage(args)
                break
            }
            case SERVER_WORLD_WORKER_MESSAGE.add_building_schema: {
                this.world.sendAll([{
                    name: ServerClient.CMD_BUILDING_SCHEMA_ADD,
                    data: {
                        list: [args]
                    }
                }])
                break
            }
        }

    }

    /**
     * Load building template schemas
     */
    initBuildings(config : Config) {
        for(const json of config.building_schemas.list) {
            BuildingTemplate.addSchema(json)
        }
    }

    getPlayer(session: PlayerSession) : ServerPlayer | null {
        return this.players.get(session.user_id)
    }

    async initBlockManager() : Promise<typeof BLOCK> {
        return this.bm || (this.bm = await BLOCK.init({
            _json_url: '../../data/block_style.json',
            _resource_packs_url: '../../data/resource_packs.json'
        } as GameSettings))
    }

    async openDB() : Promise<DBWorld> {
        this.db_conn = await SQLiteServerConnector.connect(`../world/${this.guid}/world.sqlite`)
        return this.db_world = await DBWorld.openDB(this.db_conn, this.world)
    }

    initGlobal(config) {
        // Set global variables
        let globalAny = global as any
        globalAny.__dirname     = path.resolve()
        globalAny.fs            = fs
        globalAny.Buffer        = Buffer
        globalAny.Worker        = Worker
        globalAny.Log           = {append:() => {}}
        globalAny.skiaCanvas    = skiaCanvas
        globalAny.mkdirp        = mkdirp
        // TODO:
        globalAny.Qubatch = {
            is_server: true,
            world_worker: this,
            addBuildingSchema(building) {
                this.world_worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.add_building_schema, building])
            }
        } as IQubatch
        globalAny.config        = config
        globalAny.plugins       = new PluginManager(globalAny.config)
        // for debugging client time offset
        globalAny.SERVER_TIME_LAG = config.Debug ? (0.5 - Math.random()) * 50000 : 0
        globalAny.EMULATED_PING = config.Debug ? Math.random() * 100 : 0
        globalAny.randomUUID = () => {
            return uuid()
        }
    }

    terminatePlayerConnection(session, message?: string) {
        this.postMessage([SERVER_WORLD_WORKER_MESSAGE.player_terminate_connection, {session, message}])
    }

    sendJSONString(session : PlayerSession, json_string: string) {
        this.postMessage([SERVER_WORLD_WORKER_MESSAGE.player_send_json_string, {session, json_string}])
    }

}

const worker = new WorldWorker()
