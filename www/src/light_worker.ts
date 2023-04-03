/**
 * light worker sends messages periodically, separating light waves
 */

class LightWorkerRoot {
    modulesReady = false;
    LightWorkerWorldManager = null;
    WORKER_MESSAGE = null
    worlds = null;

    RAF_MS = 16; //ms per one world update

    run = () => {
        const now = performance.now();
        try {
            this.worlds.process({maxMs: this.RAF_MS});
        } catch (e) {
            console.error(e);
        }
        const passed = Math.ceil(performance.now() - now);
        setTimeout(this.run, Math.max(0, this.RAF_MS - passed));
    }

    msgQueue = [];
    parentPort = null;

    init() {
        if (typeof process !== 'undefined') {
            import('worker_threads').then(module => {
            this.parentPort = module.parentPort;
            this.parentPort.on('message', this.onMessageFunc);
        });
        } else {
            onmessage = this.onMessageFunc
        }
    }
    postMessage(message) {
        if (this.parentPort) {
            this.parentPort.postMessage(message);
        } else {
            postMessage(message);
        }
    }

    async preLoad() {
        const start = performance.now();
        try {
            await import('./worker-light/LightWorkerWorldManager.js').then(module => {
                this.LightWorkerWorldManager = module.LightWorkerWorldManager;
            });
            await import('./constant.js').then(module => {
                this.WORKER_MESSAGE = module.WORKER_MESSAGE;
            });
            this.modulesReady = true;
        } catch (e) {
            console.error('LightWorker failed init', e);
        }

        console.debug('[LightWorker] Preloaded, load time:', performance.now() - start);
    }

    async initWorlds() {
        if (!this.modulesReady) {
            await this.preLoad();
        }

        this.worlds = new this.LightWorkerWorldManager(this);
        for (let item of this.msgQueue) {
            await this.onMessageFunc(item);
        }
        this.msgQueue.length = 0;
        this.postMessage([0, 'worker_inited', null]);

        setInterval(this.run, 20);
    }

    onMessageFunc = async (e) => {
        let data = e;
        if (typeof e == 'object' && 'data' in e) {
            data = e.data;
        }
        const world_id = data[0];
        const cmd = data[1];
        const args = data[2];
        if (cmd === 'init') { // this.WORKER_MESSAGE.INIT_LIGHT_WORKER
            await this.initWorlds();
            return;
        }
        const {worlds} = this;
        if (!worlds) {
            return this.msgQueue.push(data);
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
}

(globalThis as any).QubatchLightWorker = new LightWorkerRoot();
QubatchLightWorker.init();
QubatchLightWorker.preLoad().then();


