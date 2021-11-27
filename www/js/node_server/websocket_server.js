import {World} from "../world.js";
import {Player} from "../player.js";
import {WebSocketServer, WebSocket} from "ws";
import url from 'url';

export class GameServer {

    constructor() {
        this.is_server = true;
        // Worlds
        this.worlds = new Map();
        // Placeholder
        this.hud = {
            add: () => {},
            refresh: () => {}
        };
        this.hotbar = {
            setInventory: (items) => {}
        }
    }

    // startWS...
    startWS() {

        // Create websocket server
        this.wsServer = new WebSocketServer({
            port: 5701
        });
        this.wsServer.on('connection', async (conn, req) => {
            //
            console.log('New player connection');
            // Connect to GO server
            let query = url.parse(req.url, true).query;
            let world_guid = query.world_guid;
            let go_server_url = 'ws://localhost:5700/ws';
            let world = this.worlds.get(world_guid);
            if(!world) {
                world = new World();
                let ws = new WebSocket(go_server_url + '?world_guid=' + world_guid);
                await world.connect(ws);
                this.worlds.set(world_guid, world);
                console.log('World started');
            }
            let player = new Player();
            player.joinToServerWorld(conn, world);
        });
    }

}