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
            conn.sendMixed = function(value) {
                this.send(JSON.stringify(value));
            }
            // On player disconnected
            conn.on('close', code => {
                conn.player.world.server.RemovePlayerListeners(conn.player.session.user_guid);
                console.log('Player disconnected', conn.player.session.username);
            });
            // Connect to GO server
            let query = url.parse(req.url, true).query;
            let world_guid = query.world_guid;
            let go_server_url = 'ws://localhost:5700/ws';
            let world = this.worlds.get(world_guid);
            if(!world) {
                world = new World();
                let ws = new WebSocket(go_server_url + '?session_id=' + query.session_id + '&skin=' + query.skin + '&world_guid=' + world_guid);
                let cmd_world_info = await world.connect(ws);
                this.worlds.set(world_guid, world);
                console.log('World started');
                conn.sendMixed([cmd_world_info]);
            }
            let player = new Player();
            console.log('Before JoinToWorld');
            player.JoinToWorld(world, (ok, cmd) => {
                conn.player = player;
                console.log('Player connected to world `' + player.session.username + '` => `' + world.info.guid + "`");
                // Proxy CMD_CONNECTED
                conn.sendMixed([cmd]);
            });
        });
    }

}