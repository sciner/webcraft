import { BLOCK } from "../www/js/blocks.js";
import { Resources } from "../www/js/resources.js";
import { ServerPlayer } from "../node_server/server_player.js";
import { GameLog } from "../node_server/game_log.js";
import {ServerWorld} from "../node_server/server_world.js";
import { PluginManager } from "../node_server/plugin_manager.js";

import _config from "../node_server/conf.json" assert { type: "json" };
import features from "../www/vendors/prismarine-physics/lib/features.json" assert { type: "json" };
import { DBGame } from "../node_server/db/game.js";
import { ServerAPI } from "../node_server/server_api.js";
import { DBWorld } from "../node_server/db/world.js";

// Hack ;)
Resources.physics = {features}

globalThis.config       = _config;
globalThis.__dirname    = '';
globalThis.plugins      = new PluginManager();
globalThis.randomUUID   = () => crypto.randomUUID();

//
class PlayerConnection {

    constructor() {
        this._on = new Map();
        this.on('message', () => {});
        this.on('close', () => {});
    }

    on(event, callback) {
        this._on.set(event, callback);
    }

    close() {}

    send(json) {
        globalThis.Game.postMessage(json);
    }

}

class FakeHUD {
    add() {}
    refresh() {}
}

class FakeHotbar {
    setInventory(items) {}
}

// Local Game
export class LocalGame {

    constructor() {
        this.dt_started = new Date();
        this.is_server = true;
        this.packets_queue = [];
        // Worlds
        this.worlds = new Map();
        // Placeholder
        this.hud = new FakeHUD();
        this.hotbar = new FakeHotbar();
        //
        onmessage = this.onmessage.bind(this);
        //
        DBGame.openLocalDB('.').then((db) => {
            this.db = db;
            globalThis.Log = new GameLog(db);
            console.debug(performance.now(), 'Game db inited!');
            // Packets queue, because db was not inited
            while(this.packets_queue.length > 0) {
                this.onmessage(this.packets_queue.shift());
            }
        });
    }

    async start() {
        await BLOCK.init({
            json_url: '/data/block_style.json',
            resource_packs_url: '/data/resource_packs.json',
            resource_packs_basedir: '/'
        });
        this.postMessage('connected');
    }

    async onmessage(e) {
        if(!this.db) {
            // Add event to packets queue, because db not inited
            this.packets_queue.push(e);
            return;
        }
        const packet = JSON.parse(e.data);
        const cmd = packet.name;
        const data = packet.data;
        switch(cmd) {
            case '_connect': {
                const query         = new URL(data).searchParams;
                const skin          = query.get('skin');
                const world_guid    = query.get('world_guid');
                const session_id    = query.get('session_id');
                const game_world    = await this.db.getWorld(world_guid);
                let world           = this.worlds.get(world_guid);
                Log.append('WsConnected', {world_guid, session_id: session_id});
                if(!world) {
                    world = new ServerWorld(BLOCK);
                    const db_world = await DBWorld.openLocalDB('/world/' + world_guid, world);
                    await world.initServer(world_guid, db_world);
                    this.worlds.set(world_guid, world);
                    console.log('World started');
                }
                const player = new ServerPlayer();
                this.player_conn = new PlayerConnection();
                player.onJoin(session_id, skin, this.player_conn, world);
                await this.db.IncreasePlayCount(game_world.id, session_id);
                break;
            }
            case '_api': {
                const {id, session_id, method, params} = data;
                try {
                    const result = await ServerAPI.call(method, params, session_id);
                    this.postMessage({name: '_api_result', data: {id, result}});
                } catch(e) {
                    let message = e.code || e;
                    let code = 950;
                    if(message == 'error_invalid_session') {
                        code = 401;
                    }
                    this.postMessage({
                        name: '_api_result',
                        data: {
                            id,
                            result: {
                                code,
                                message,
                                status: 'error'
                            }
                        }
                    });
                }
                break;
            }
            default: {
                const that = this;
                const on_message = that.player_conn._on.get('message');
                on_message(e.data);
                break;
            }
        }
    }

    //
    postMessage(data) {
        postMessage(data);
    }

}

globalThis.Game = new LocalGame();
Game.start();