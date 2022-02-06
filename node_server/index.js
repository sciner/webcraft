import path from 'path'
import express from "express"; 
import compression from "compression";
import fs from 'fs';
import {Worker} from "worker_threads";
import uuid from 'uuid';

import {BLOCK} from "../www/js/blocks.js";
import {Resources} from "../www/js/resources.js";
import {ServerGame} from "./server_ws.js";
import {ServerStatic} from "./server_static.js";
import {ServerAPI} from "./server_api.js";
import {PluginManager} from "./plugin_manager.js";
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
global.plugins          = new PluginManager();
global.randomUUID       = () => {
    return uuid();
};

console.log('Server config', config);

// Init environment
await BLOCK.init();

// Hack ;)
Resources.physics = {
    features: features // (await import("../../vendors/prismarine-physics/lib/features.json")).default
}

// http://expressjs.com/en/api.html#req.originalUrl
var app = express();
// Compress all HTTP responses
app.use(compression({
    // filter: Decide if the answer should be compressed or not,
    // depending on the 'shouldCompress' function above
    filter: (req, res) => {
        const ext = req._parsedUrl.pathname.split('.').pop().toLowerCase();
        if(['vox'].indexOf(ext) >= 0) {
            return true;
        }
        if (req.headers['x-no-compression']) {
            // Will not compress responses, if this header is present
            return false;
        }
        // Resort to standard compression
        return compression.filter(req, res);
    },
    // threshold: It is the byte threshold for the response 
    // body size before considering compression, the default is 1 kB
    threshold: 0
}));
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