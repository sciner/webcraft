import {ServerClient} from "../server_client.js";
import {World} from "../world.js";
import {Player} from "../player.js";

// import {WorkerWorldManager} from "../worker/world.js";

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
    }

    // startWS...
    startWS() {

        // Create websocket server
        this.wsServer = new WebSocketServer({
            port: 5701
        });
        this.wsServer.on('connection', (conn, req) => {
            //
            conn.sendMixed = function(value) {
                this.send(JSON.stringify(value));
            }
            // On client close
            conn.on('close', code => {
                if(!conn.go_server) {
                    return;
                }
                try {
                    console.log('on close from CLIENT side', code);
                    conn.go_server.close(code);
                    conn.go_server = null;
                } catch(e) {
                    console.error(e);
                }
            });
            // Connect to GO server
            let query = url.parse(req.url, true).query;
            let go_server_url = 'ws://localhost:5700/ws' + '?session_id=' + query.session_id + '&skin=' + query.skin;
            conn.go_server = new ServerClient((cmd) => {
                conn.connected = true;
                conn.sendMixed([cmd]);
            });
            //
            conn.go_server.postPlayerConnect = (data) => {
                let world = this.worlds.get(data.world.guid);
                // Set only in first time
                if(!world.info) {
                    world.setInfo(data.world);
                }
                console.log('User connected to world `' + data.player.username + '` => `' + world.info.guid + "`");
                conn.sendMixed([{name: ServerClient.CMD_CONNECTED, data: data}]);
            };
            //
            conn.go_server.connect(new WebSocket(go_server_url), () => {
                // Receive message
                conn.on('message', message => {
                    if(!conn.connected) {
                        return;
                    }
                    message = JSON.parse(message);
                    if([ServerClient.CMD_PING].indexOf(message.name) < 0) {
                        // console.log('player > ', message);
                    }
                    switch(message.name) {
                        case ServerClient.CMD_PING: {
                            conn.sendMixed([{name: ServerClient.CMD_PONG, data: null}]);
                            break;
                        }
                        case ServerClient.CMD_CONNECT: {
                            let world_guid = message.data.world_guid;
                            if(!this.worlds.has(world_guid)) {
                                this.worlds.set(world_guid, new World());
                            }
                            let player = new Player(this.worlds.get(world_guid));
                            Game.player = player;
                            conn.go_server.SetPlayer(player);
                            conn.go_server.Send({name: ServerClient.CMD_CONNECT, data: {world_guid: world_guid}});
                            console.log('Connect to world `' + world_guid + '`');
                            break;
                        }
                    }
                });
            }, () => {
                // On close from GO server
                conn.close();
            });
        });
    }

}