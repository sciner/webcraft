import path from 'path'
import express from "express";
import expressLess from "express-less";
import compression from "compression";
import fs from 'fs';
import {Worker} from "worker_threads";
import { v4 as uuid } from 'uuid';
import sqlite3 from 'sqlite3'
import semver from 'semver';
import bodyParser from 'body-parser';
import fileUpload from "express-fileupload";
import { renderFile } from "ejs";

// Check version of modules
const required_versions = {
    nodejs: '17.2.0 - 17.9.0',
    sqlite3: '>= 3.38.4' // 5.0.8
};
function checkVersion(module_name, current) {
    const need_version = required_versions[module_name];
    if(!semver.satisfies(current, need_version) ) {
        console.error(`${module_name} required version ${need_version}, but present is ${current}`);
        process.exit();
    }
}

checkVersion('nodejs', semver.coerce(process.version));
checkVersion('sqlite3', sqlite3.VERSION);

// Require compiled resource pack
try {
    if(!fs.existsSync('../www/resource_packs/base/blocks.json')) {
        console.error('Resource pack not compiled.\nPlease run `npm run compile-texture-pack` in directory ./node_server/ ');
        process.exit();
    }
} catch(err) {
    console.error(err)
    process.exit();
}

//
import {Lang} from "../www/js/lang.js";
import {BLOCK} from "../www/js/blocks.js";
import {Resources} from "../www/js/resources.js";
import {ServerGame} from "./server_game.js";
import {ServerAPI} from "./server_api.js";
import {PluginManager} from "./plugin_manager.js";
import config from './config.js';

Lang.init();

// Set global variables
global.__dirname        = path.resolve();
global.Worker           = Worker;
global.fs               = fs;
global.config           = config;
global.plugins          = new PluginManager();
global.Qubatch          = new ServerGame();
global.randomUUID       = () => {
    return uuid();
};

console.log('Server config', config);

// Init environment
await BLOCK.init({
    _json_url: __dirname + '/../data/block_style.json',
    _resource_packs_url: __dirname + '/../data/resource_packs.json'
});

// Hack ;)
import features from "../www/vendors/prismarine-physics/lib/features.json" assert { type: "json" };
Resources.physics = {features}; // (await import("../../vendors/prismarine-physics/lib/features.json")).default

// http://expressjs.com/en/api.html#req.originalUrl
const app = express();

const page = {
    domain: config.DomainURL,
    title: config.ProjectName
};

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
// express.static.mime.define({'application/json': ['bbmodel']})
// express.mime.type['bbmodel'] = 'application/json';
app.use(express.json());
app.engine('html', renderFile);
app.set('view engine', 'html');

const pathToIndex = path.resolve(__dirname, '..', 'www', 'index.html')

// Prehook
app.use(async function(req, _res, next) {
    // Log referrer
    const ref = req.get('Referrer');
    if(ref && ref.indexOf(`//${req.get('host')}`) < 0) {
        await Qubatch.db.ReferrerAppend(ref, req.headers);
    }
    // Rewrite
    if(req.url.indexOf('/www') === 0) req.url = req.url.substring(4);
    if(req.url == '/') {
        _res.render(pathToIndex, {page});
    } else {
        next();
    }
});

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

// Serves resources from public folder
app.use('/style', expressLess(__dirname + '/../www/style', { compress: true, debug: true }));
app.use(express.static('../www/'));

// API

app.use('/api/Game/Screenshot', fileUpload({
    debug: true,
    limits: { fileSize: 50 * 1024 * 1024 },
    useTempFiles : true,
    abortOnLimit: true
}));

app.use('/api', async(req, res) => {
    try {
        const resp = await ServerAPI.call(req.originalUrl, req.body, req.get('x-session-id'), req);
        res.status(200).json(resp);
    } catch(e) {
        console.debug('> API: ' + e);
        let message = e.code || e;
        let code = 950;
        if(message == 'error_invalid_session') {
            code = 401;
        }
        res.status(200).json(
            {"status":"error","code": code, "message": message}
        );
    }
});

//
app.use('/worldcover/', async(req, res) => {
    const filename = path.resolve(__dirname, '..', 'world', req.url.substring(1));
    res.sendFile(filename);
});

// "SPA" yet for just one type of ulrs only
app.use('/worlds', async(req, res) => {
    const world_guid = req.url.split('/')[1];
    const world = await Qubatch.db.getWorld(world_guid);
    page.title = `${config.ProjectName} - ${world.title}`;
    res.render(pathToIndex, {page, world});
});

Qubatch.start(config);

// Start express
const server = app.listen(config.Port);

// Pair with websocket server
server.on('upgrade', (request, socket, head) => {
    Qubatch.wsServer.handleUpgrade(request, socket, head, socket => {
        Qubatch.wsServer.emit('connection', socket, request);
    });
});

console.log(`Game listening at http://${config.ServerIP}:${config.Port}`);