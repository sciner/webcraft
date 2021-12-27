import path from 'path'
import express from "express"; 
import fs from 'fs';
import {Worker} from "worker_threads";

import {BLOCK} from "../www/js/blocks.js";
import {Resources} from "../www/js/resources.js";
import {ServerGame} from "./server_ws.js";
import {ServerStatic} from "./server_static.js";
import {ServerAPI} from "./server_api.js";
import config from './config.js';

import features from "../www/vendors/prismarine-physics/lib/features.json" assert { type: "json" };

// Set global variables
global.__dirname        = path.resolve();
global.Worker           = Worker;
global.fs               = fs;
global.BLOCK_CHEST      = 54;
global.GAME_ONE_SECOND  = 72;
global.GAME_DAY_SECONDS = 24000;
global.config           = config;

console.log('Server config', config);

// Init environment
await BLOCK.init();

// Hack ;)
Resources.physics = {
    features: features // (await import("../../vendors/prismarine-physics/lib/features.json")).default
}

// http://expressjs.com/en/api.html#req.originalUrl
var app = express();
ServerStatic.init(app);
ServerAPI.init(app);

global.Game = new ServerGame();
Game.startWS();

// Start express
const server = app.listen(config.Port);

// Pair with websocket server
server.on('upgrade', (request, socket, head) => {
    Game.wsServer.handleUpgrade(request, socket, head, socket => {
        Game.wsServer.emit('connection', socket, request);
    });
});

console.log(`Game listening at http://${config.ServerIP}:${config.Port}`);