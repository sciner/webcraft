import { BLOCK } from "../www/js/blocks.js";
import { Resources } from "../www/js/resources.js";
import { ServerPlayer } from "../node_server/server_player.js";
import { GameLog } from "../node_server/game_log.js";
import {ServerWorld} from "../node_server/server_world.js";
import { PluginManager } from "../node_server/plugin_manager.js";

import _config from "../node_server/conf.json" assert { type: "json" };
import features from "../www/vendors/prismarine-physics/lib/features.json" assert { type: "json" };
import { DBGame } from "../node_server/db/game.js";

// Hack ;)
Resources.physics = {features}

globalThis.config       = _config;
globalThis.__dirname    = '';
globalThis.plugins      = new PluginManager();
globalThis.randomUUID   = () => crypto.randomUUID();

//
class DBWorld {

    constructor() {
        // quests
        this.quests = {
            defaults: async () => [],
            loadPlayerQuests: async () => [],
            userStarted: async () => true
        }
        // mobs
        this.mobs = {
            loadInChunk: (addr, size) => new Map(),
            chunkMobsIsGenerated: async (chunk_addr_hash) => true,
            create: async (params) => {
                return {
                    id:         1,
                    entity_id:  randomUUID(),
                    pos_spawn:  params.pos.clone(),
                    is_active:  true
                };
            }
        }
    }

    loadAdminList(world_id) {
        return [];
    }

    async chunkBecameModified() {
        const resp = new Set();
        return resp;
    }

    async getWorld(world_guid) {
        return {
            "id":           1,
            "user_id":      1001,
            "dt":           1658147042,
            "guid":         world_guid,
            "title":        "Local",
            "seed":         "2860976949",
            "game_mode":    "survival",
            "generator":    {"id":"biome2","options":{"auto_generate_mobs":true}},
            "pos_spawn":    {"x":2895.7,"y":120,"z":2783.06},
            "rules":        {},
            "state":        null,
            "add_time":     -29080
        };
    }

    async registerPlayer(world, player) {
        return {
            "state": {
                "pos":                  {"x":1047.532,"y":75,"z":1835.253},
                "pos_spawn":            {"x":2895.7,"y":120,"z":2783.06},
                "rotate":               {"x":-0.2484,"y":0,"z":0.8477},
                "indicators":           {"live":{"name":"live","value":20},"food":{"name":"food","value":20},"oxygen":{"name":"oxygen","value":10}},
                "chunk_render_dist":    4,
                "game_mode":            "creative",
                "stats":                {"death": 0, "time": 1000, "pickat": 0, "distance": 679}
            },
            "inventory": {
                "current":{"index":2,"index2":-1},
                "items": [null,{"id":521,"count":1},{"id":8,"count":16},{"id":659,"count":3},null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]
            }
        };
    }

    async loadDropItems(addr, size) {
        return new Map();
    }

    async updateAddTime(world_guid, add_time) {}

    async changeRenderDist(player, value) {}

    async savePlayerState(player) {}

    async savePlayerInventory(player, params) {}

    async blockSetBulk(world, player, data) {}

    async updateChunks(address_list) {}

    async blockSet(world, player, params) {}

    async TransactionBegin() {}

    async TransactionCommit() {}

    async TransactionRollback() {}

    async loadChunkModifiers(addr) {}

    async changeGameMode(player, game_mode) {}

    getDefaultPlayerIndicators() {
        return {
            live: {
                name:  'live',
                value: 20,
            },
            food: {
                name:  'food',
                value: 20,
            },
            oxygen: {
                name:  'oxygen',
                value: 10,
            },
        };
    }

}

/*
//
class LocalDBGame {

    async GetPlayerSession(session_id) {
        return {
            "user_id":      1001,
            "user_guid":    "e953ac26-5e68-432a-886a-226708ca1bbf",
            "username":     "player",
            "flags":        256,
            "session_id":   session_id
        }
    }

    async getWorld(world_guid)  {
        return {
            id:         1,
            guid:       world_guid
        };
    }

    async LogAppend(event_name, data) {}

    async IncreasePlayCount(world_id, session_id) {}

}
*/

//
class Conn {

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
        // Worlds
        this.worlds = new Map();
        // Placeholder
        this.hud = new FakeHUD();
        this.hotbar = new FakeHotbar();
        //
        onmessage = this.onmessage.bind(this);
    }

    async init() {
        this.db = await DBGame.openLocalDB('.'); // new LocalDBGame();
        globalThis.Log = new GameLog(this.db);
        await BLOCK.init({
            json_url: '/data/block_style.json',
            resource_packs_url: '/data/resource_packs.json',
            resource_packs_basedir: '/'
        });
        this.postMessage('connected');
    }

    async onmessage(e) {
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
                    const db_world = new DBWorld(world_guid); // await DBWorld.openDB('../world/' + world_guid, world);
                    await world.initServer(world_guid, db_world);
                    this.worlds.set(world_guid, world);
                    console.log('World started');
                }
                const player = new ServerPlayer();
                this.player_conn = new Conn();
                player.onJoin(session_id, skin, this.player_conn, world);
                await this.db.IncreasePlayCount(game_world.id, session_id);
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
Game.init();