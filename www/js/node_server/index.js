import {WebSocketServer} from "ws";
import {BLOCK} from "../blocks.js";
import {Helpers} from "../helpers.js";
import {WorkerWorldManager} from "../worker/world.js";
import fs from 'fs';

let wsServer            = null;
let worlds              = null;

await BLOCK.init();
console.log('All blocks loaded, count: ', BLOCK.BLOCK_BY_ID.size);

Helpers.fs = fs;
worlds = new WorkerWorldManager();
await worlds.InitTerrainGenerators();

// Create websocket server
wsServer = new WebSocketServer({
    port: 5701
});
wsServer.on('connection', conn => {
    // Receive message
    conn.on('message', message => {
        let data = JSON.parse(message);
        console.log('onmessage', data);
        let cmd = data[0];
        let args = data[1];
        switch(cmd) {
            case 'terrainGenerators': {
                conn.send(JSON.stringify([ ...terrainGenerators.keys() ]));            
                break;
            }
            case 'ping': {
                conn.send(JSON.stringify('pong'));
                break;
            }
            case 'init': {
                // Init modules
                let seed = data[2];
                let world_id = data[3];
                conn.world = worlds.add(args.id, seed, world_id);
                conn.send(JSON.stringify(['world_inited', null]));
                break;
            }
            case 'getWorld': {
                if(conn.world) {
                    let world = conn.world;
                    conn.send(JSON.stringify({
                        id: world.generator.world_id,
                        generator: {
                            seed: world.generator.seed
                        }
                    }));
                } else {
                    conn.send(JSON.stringify(null));
                }
                break;
            }
            case 'createChunk': {
                if(!conn.world) {
                    return conn.send(JSON.stringify(null));
                }
                let c = conn.world.createChunk(args);
                conn.send(JSON.stringify(['blocks_generated', c]));
                break;
            }
        }
    });
});