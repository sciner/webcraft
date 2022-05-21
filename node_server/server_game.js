import url from 'url';
import {WebSocketServer, WebSocket} from "ws";

import {DBGame} from "./db_game.js";
import {DBWorld} from "./db_world.js";
import {ServerWorld} from "./server_world.js";
import {ServerPlayer} from "./server_player.js";
import {GameLog} from './game_log.js';

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
        // Placeholder
        this.hud = new FakeHUD();
        this.hotbar = new FakeHotbar();
    }

    // startWS...
    async startWS() {
        this.db = await DBGame.openDB('.');
        global.Log = new GameLog(this.db);
        // Create websocket server
        this.wsServer = new WebSocketServer({noServer: true}); // {port: 5701}
        // New player connection
        this.wsServer.on('connection', async (conn, req) => {
            console.log('New player connection');
            let query           = url.parse(req.url, true).query;
            let world_guid      = query.world_guid;
            let world           = this.worlds.get(world_guid);
            const game_world    = await this.db.getWorld(world_guid);
            Log.append('WsConnected', {world_guid, session_id: query.session_id});
            if(!world) {
                world = new ServerWorld();
                let db_world = await DBWorld.openDB('../world/' + world_guid, world);
                await world.initServer(world_guid, db_world);
                this.worlds.set(world_guid, world);
                console.log('World started');
            }
            let player = new ServerPlayer();
            player.onJoin(query.session_id, query.skin, conn, world);
            await this.db.IncreasePlayCount(game_world.id, query.session_id);
        });
    }

}