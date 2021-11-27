import path from 'path'
import express from "express"; 
import fs from 'fs';
import {Worker} from "worker_threads";

import {BLOCK} from "../blocks.js";
import {Resources} from "../resources.js";
import {ServerGame} from "./server_ws.js";
import {ServerStatic} from "./server_static.js";
import {ServerAPI} from "./server_api.js";

import features from "../../vendors/prismarine-physics/lib/features.json" assert { type: "json" };

// Set global variables
global.__dirname = path.resolve();
global.Worker = Worker;
global.fs = fs;

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
const server = app.listen(5701);

// Pair with websocket server
server.on('upgrade', (request, socket, head) => {
    Game.wsServer.handleUpgrade(request, socket, head, socket => {
        Game.wsServer.emit('connection', socket, request);
    });
});