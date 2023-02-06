/**
 * light worker sends messages periodically, separating light waves
 */
let modulesReady = false;
let Vector = null;
let LightWorkerWorldManager = null;
let worlds = null;

const RAF_MS = 16; //ms per one world update

function run() {
    const now = performance.now();
    try {
        worlds.process({maxMs: RAF_MS});
    } catch (e) {
        console.error(e);
    }
    const passed = Math.ceil(performance.now() - now);
    setTimeout(run, Math.max(0, RAF_MS - passed));
}

const msgQueue = [];

const worker = {
    init: function () {
        if (typeof process !== 'undefined') {
            import('worker_threads').then(module => {
                this.parentPort = module.parentPort;
                this.parentPort.on('message', onMessageFunc);
            });
        } else {
            onmessage = onMessageFunc
        }
    },

    postMessage: function (message) {
        if (this.parentPort) {
            this.parentPort.postMessage(message);
        } else {
            postMessage(message);
        }
    }

}

worker.init();

preLoad().then();

async function preLoad() {
    const start = performance.now();

    await import("./helpers.js").then(module => {
        Vector = module.Vector;
    });
    await import('./worker-light/LightWorkerWorldManager.js').then(module => {
        LightWorkerWorldManager = module.LightWorkerWorldManager;
    });
    modulesReady = true;

    console.debug('[LightWorker] Preloaded, load time:', performance.now() - start);
}

async function initWorlds() {
    if (!modulesReady) {
        await preLoad();
    }

    worlds = new LightWorkerWorldManager(worker);
    for (let item of msgQueue) {
        await onmessage(item);
    }
    msgQueue.length = 0;
    worker.postMessage([0, 'worker_inited', null]);

    setInterval(run, 20);
}

async function onMessageFunc(e) {
    let data = e;
    if (typeof e == 'object' && 'data' in e) {
        data = e.data;
    }
    const world_id = data[0];
    const cmd = data[1];
    const args = data[2];
    if (cmd === 'init') {
        await initWorlds();
        return;
    }
    if (!worlds) {
        return msgQueue.push(data);
    }
    //do stuff
    const world = worlds.getOrCreate(world_id);

    switch (cmd) {
        case 'destructWorld': {
            worlds.dispose(world_id);
            break;
        }
        case 'initRender': {
            worlds.setRenderOptions(args);
            break;
        }
        default: {
            world.onMessage([cmd, args]);
        }
    }
}