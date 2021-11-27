import {BLOCK} from "../blocks.js";
import {Resources} from "../resources.js";
import {GameServer} from "./websocket_server.js";
import {StaticServer} from "./static_server.js";

import features from "../../vendors/prismarine-physics/lib/features.json";

import fs from 'fs';
import {Worker} from "worker_threads";

global.Worker = Worker;

StaticServer.init();

// Init environment
await BLOCK.init();
// worlds = new WorkerWorldManager();
// await worlds.InitTerrainGenerators();

// Hack ;)
Resources.physics = {
    features: features // (await import("../../vendors/prismarine-physics/lib/features.json")).default
}

global.Game = new GameServer();
global.fs = fs;
Game.startWS();